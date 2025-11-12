/**
 * DeonPay API Worker
 * Cloudflare Worker with Hono framework
 * Multi-acquirer payment processing API
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { hashSecretKey, isSecretKey, isPublicKey } from './lib/crypto'

// Import middlewares
import { requestIdMiddleware } from './middleware/requestId'
import { rateLimitMiddleware } from './middleware/rateLimit'
import { idempotencyMiddleware } from './middleware/idempotency'
import { requestLogMiddleware } from './middleware/requestLog'

// Import routes
import { paymentIntentsRouter } from './routes/payment-intents'
import { customersRouter } from './routes/customers'
import { refundsRouter } from './routes/refunds'
import { balanceRouter } from './routes/balance'

// Import and register adapters
import { registerAdapter } from './router/adapters'
import { mockAdapter } from './router/adapters/mock'
import { cyberSourceAdapter } from './router/adapters/cybersource'

// Register adapters on startup
registerAdapter(mockAdapter)
registerAdapter(cyberSourceAdapter)

// Types for Cloudflare Worker bindings and context variables
type Bindings = {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  ENVIRONMENT: string
  DEFAULT_ADAPTER?: string
  RATE_LIMIT_KV?: KVNamespace
  IDEMPOTENCY_KV?: KVNamespace
  RATE_LIMIT_MAX?: string
  RATE_LIMIT_WINDOW_MS?: string
  IDEMPOTENCY_TTL_SECONDS?: string
}

type Variables = {
  supabase: SupabaseClient
  requestId: string
  merchantId: string
  apiKey: any
}

// Create Hono app with types
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ============================================================================
// MIDDLEWARE
// ============================================================================

// CORS - Allow all origins for now (restrict in production)
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-ID'],
}))

// Logger
app.use('*', logger())

// Request ID - Generate/extract unique request ID for tracing
app.use('*', requestIdMiddleware)

// Supabase client middleware - attach to context
app.use('*', async (c, next) => {
  const supabaseUrl = c.env.SUPABASE_URL
  const supabaseKey = c.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return c.json({
      error: {
        type: 'api_error',
        message: 'Supabase configuration missing',
      }
    }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Attach Supabase client to context
  c.set('supabase', supabase)

  await next()
})

// API Key authentication middleware
app.use('/api/v1/*', async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    return c.json({
      error: {
        type: 'authentication_error',
        message: 'Missing Authorization header',
        code: 'missing_auth',
      }
    }, 401)
  }

  // Extract Bearer token
  const token = authHeader.replace(/^Bearer\s+/i, '')

  if (!token) {
    return c.json({
      error: {
        type: 'authentication_error',
        message: 'Invalid Authorization format. Use: Bearer <api_key>',
        code: 'invalid_auth_format',
      }
    }, 401)
  }

  // Validate API key against database
  const supabase = c.get('supabase')
  let apiKey = null

  // Check if it's a Secret Key (sk_) or Public Key (pk_)
  if (isSecretKey(token)) {
    // For Secret Keys, we need to hash it and compare with secret_key_hash
    const keyHash = await hashSecretKey(token)

    const { data, error } = await supabase
      .from('api_keys')
      .select('id, merchant_id, key_type, is_active, public_key, secret_key_hash')
      .eq('secret_key_hash', keyHash)
      .eq('is_active', true)
      .single()

    if (!error && data) {
      apiKey = data
    }
  } else if (isPublicKey(token)) {
    // For Public Keys, we can compare directly
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, merchant_id, key_type, is_active, public_key')
      .eq('public_key', token)
      .eq('is_active', true)
      .single()

    if (!error && data) {
      apiKey = data
    }
  }

  if (!apiKey) {
    return c.json({
      error: {
        type: 'authentication_error',
        message: 'Invalid or inactive API key',
        code: 'invalid_api_key',
      }
    }, 401)
  }

  // Set PostgreSQL session variables for RLS policies
  const { error: contextError } = await supabase.rpc('set_merchant_context', {
    p_merchant_id: apiKey.merchant_id,
    p_key_type: apiKey.key_type
  })

  if (contextError) {
    console.error('Failed to set merchant context:', contextError)
  }

  // Update last_used_at timestamp (fire and forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)
    .then(() => {})

  // Attach merchant_id to context for RLS
  c.set('merchantId', apiKey.merchant_id)
  c.set('apiKey', apiKey)

  await next()
})

// Rate Limiting - 60 req/min per merchant+route (after auth)
app.use('/api/v1/*', rateLimitMiddleware)

// Idempotency - Handle Idempotency-Key header (after rate limit)
app.use('/api/v1/*', idempotencyMiddleware)

// Request Logging - Log all requests to session_logs (at the end)
app.use('*', requestLogMiddleware)

// ============================================================================
// ROUTES
// ============================================================================

// Health check
app.get('/', (c) => {
  return c.json({
    service: 'DeonPay API',
    version: '1.0.0',
    status: 'healthy',
    environment: c.env.ENVIRONMENT || 'unknown',
  })
})

// API v1 routes
app.route('/api/v1/payment_intents', paymentIntentsRouter)
app.route('/api/v1/customers', customersRouter)
app.route('/api/v1/refunds', refundsRouter)
app.route('/api/v1/balance', balanceRouter)

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.notFound((c) => {
  return c.json({
    error: {
      type: 'invalid_request_error',
      message: 'Endpoint not found',
      code: 'not_found',
    }
  }, 404)
})

// Global error handler
app.onError((err, c) => {
  console.error('API Error:', err)

  return c.json({
    error: {
      type: 'api_error',
      message: err.message || 'Internal server error',
      code: 'internal_error',
    }
  }, 500)
})

// ============================================================================
// EXPORT
// ============================================================================

export default app
