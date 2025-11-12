/**
 * Rate Limit Middleware
 * Limits requests per merchant per route
 * Default: 60 requests per minute per merchant+route
 */

import { RateLimitStore } from '../lib/rateLimitStore'
import { errorResponse, rateLimitedError } from '../lib/errors'
import type { MiddlewareHandler } from 'hono'

export const rateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const merchantId = c.get('merchantId')
  if (!merchantId) {
    // No merchant ID means auth middleware hasn't run yet - skip
    return await next()
  }

  const routeKey = `${c.req.method}:${c.req.path}`

  // Initialize store with KV if available
  const store = new RateLimitStore(c.get('supabase'), c.env.RATE_LIMIT_KV)

  // Check and increment counter
  const result = await store.checkAndIncrement(merchantId, routeKey, {
    maxRequests: parseInt(c.env.RATE_LIMIT_MAX || '60'),
    windowMs: parseInt(c.env.RATE_LIMIT_WINDOW_MS || '60000'),
  })

  // Add rate limit headers
  c.header('X-RateLimit-Limit', (c.env.RATE_LIMIT_MAX || '60'))
  c.header('X-RateLimit-Remaining', result.remaining.toString())
  c.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString())

  // Reject if rate limit exceeded
  if (!result.allowed) {
    return errorResponse(c, rateLimitedError(), 429)
  }

  await next()
}
