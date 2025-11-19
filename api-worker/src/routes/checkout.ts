/**
 * Checkout Routes
 * Handles checkout session creation and management
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types/hono'
import { emitEvent } from '../router/events'

const app = new Hono<HonoContext>()

// ============================================================================
// SCHEMAS
// ============================================================================

/**
 * Line item schema for checkout
 */
const LineItemSchema = z.object({
  // Product reference
  product_id: z.string().uuid().optional(),

  // Ad-hoc pricing (if no product_id)
  price_data: z.object({
    unit_amount: z.number().int().min(0),
    currency: z.string().length(3).toUpperCase().default('MXN'),
    product_data: z.object({
      name: z.string(),
      description: z.string().optional(),
      images: z.array(z.string().url()).optional(),
      metadata: z.record(z.any()).optional(),
    }),
  }).optional(),

  quantity: z.number().int().min(1).default(1),

  // Tax configuration
  tax_rates: z.array(z.string()).optional(),

  // Dynamic tax behavior
  dynamic_tax_rates: z.array(z.string()).optional(),
})

/**
 * Shipping option schema
 */
const ShippingOptionSchema = z.object({
  shipping_rate_data: z.object({
    display_name: z.string(),
    type: z.enum(['fixed_amount']),
    fixed_amount: z.object({
      amount: z.number().int().min(0),
      currency: z.string().length(3).toUpperCase().default('MXN'),
    }),
    delivery_estimate: z.object({
      minimum: z.object({
        unit: z.enum(['business_day', 'day', 'hour', 'week', 'month']),
        value: z.number().int().min(1),
      }),
      maximum: z.object({
        unit: z.enum(['business_day', 'day', 'hour', 'week', 'month']),
        value: z.number().int().min(1),
      }),
    }).optional(),
  }),
})

/**
 * Custom field schema
 */
const CustomFieldSchema = z.object({
  key: z.string(),
  label: z.object({
    type: z.enum(['custom']),
    custom: z.string(),
  }),
  type: z.enum(['text', 'dropdown', 'numeric']),
  optional: z.boolean().default(false),
  dropdown: z.object({
    options: z.array(z.object({
      label: z.string(),
      value: z.string(),
    })),
  }).optional(),
})

/**
 * Checkout session creation schema
 */
const CreateCheckoutSessionSchema = z.object({
  mode: z.enum(['payment', 'subscription', 'setup']).default('payment'),

  // Line items (required)
  line_items: z.array(LineItemSchema).min(1),

  // Customer information
  customer_id: z.string().uuid().optional(),
  customer_email: z.string().email().optional(),

  // URLs (required)
  success_url: z.string().url(),
  cancel_url: z.string().url(),

  // Payment configuration
  currency: z.string().length(3).toUpperCase().default('MXN'),
  payment_method_types: z.array(z.string()).optional(),

  // Billing and shipping
  billing_address_collection: z.enum(['auto', 'required']).optional(),
  shipping_address_collection: z.object({
    allowed_countries: z.array(z.string().length(2)), // ISO country codes
  }).optional(),
  shipping_options: z.array(ShippingOptionSchema).optional(),

  // Tax configuration
  automatic_tax: z.object({
    enabled: z.boolean(),
  }).optional(),
  tax_id_collection: z.object({
    enabled: z.boolean(),
  }).optional(),

  // Promotion codes
  allow_promotion_codes: z.boolean().optional(),
  discounts: z.array(z.object({
    coupon: z.string().optional(),
    promotion_code: z.string().optional(),
  })).optional(),

  // Custom fields
  custom_fields: z.array(CustomFieldSchema).optional(),

  // Consent collection
  consent_collection: z.object({
    terms_of_service: z.enum(['required', 'none']).optional(),
    promotions: z.enum(['auto', 'none']).optional(),
  }).optional(),

  // Session configuration
  expires_after_hours: z.number().min(0.5).max(24).default(24),
  locale: z.string().default('es'),

  // Metadata
  metadata: z.record(z.any()).optional(),

  // After completion behavior
  after_completion: z.object({
    type: z.enum(['redirect', 'hosted_confirmation']),
    redirect: z.object({
      url: z.string().url(),
    }).optional(),
  }).optional(),

  // Phone number collection
  phone_number_collection: z.object({
    enabled: z.boolean(),
  }).optional(),

  // Submit button customization
  submit_type: z.enum(['auto', 'pay', 'book', 'donate']).optional(),

  // Client reference ID
  client_reference_id: z.string().optional(),
})

/**
 * Query parameters for retrieving checkout session
 */
const GetCheckoutSessionQuerySchema = z.object({
  expand: z.array(z.string()).optional(),
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate line item totals
 */
async function calculateLineItemTotals(
  supabase: any,
  lineItem: any,
  merchantId: string
): Promise<{
  amount_subtotal: number
  amount_total: number
  amount_tax: number
  name: string
  description?: string
  images: string[]
}> {
  let unitAmount: number
  let name: string
  let description: string | undefined
  let images: string[] = []

  if (lineItem.product_id) {
    // Fetch product details
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', lineItem.product_id)
      .eq('merchant_id', merchantId)
      .single()

    if (error || !product) {
      throw new Error('Product not found')
    }

    if (!product.active) {
      throw new Error('Product is not active')
    }

    unitAmount = product.unit_amount
    name = product.name
    description = product.description
    images = product.images || []
  } else if (lineItem.price_data) {
    // Use ad-hoc pricing
    unitAmount = lineItem.price_data.unit_amount
    name = lineItem.price_data.product_data.name
    description = lineItem.price_data.product_data.description
    images = lineItem.price_data.product_data.images || []
  } else {
    throw new Error('Line item must have either product_id or price_data')
  }

  const quantity = lineItem.quantity || 1
  const subtotal = unitAmount * quantity

  // TODO: Calculate tax based on tax_rates
  const tax = 0

  const total = subtotal + tax

  return {
    amount_subtotal: subtotal,
    amount_total: total,
    amount_tax: tax,
    name,
    description,
    images,
  }
}

/**
 * Generate a unique URL key for checkout session
 */
function generateUrlKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const randomValues = new Uint8Array(32)
  crypto.getRandomValues(randomValues)
  return Array.from(randomValues)
    .map(value => chars[value % chars.length])
    .join('')
}

// ============================================================================
// POST /api/v1/checkout/sessions - Create checkout session
// ============================================================================
app.post('/sessions', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const body = await c.req.json()

    // Validate request body
    const validatedData = CreateCheckoutSessionSchema.parse(body)

    // Generate URL key
    const urlKey = generateUrlKey()

    // Calculate expiration
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + validatedData.expires_after_hours)

    // Process line items and calculate totals
    const lineItemsData = []
    let totalSubtotal = 0
    let totalTax = 0
    let totalAmount = 0

    for (const lineItem of validatedData.line_items) {
      const totals = await calculateLineItemTotals(supabase, lineItem, merchantId)

      lineItemsData.push({
        product_id: lineItem.product_id,
        price_data: lineItem.price_data,
        quantity: lineItem.quantity || 1,
        ...totals,
        tax_rates: lineItem.tax_rates || [],
      })

      totalSubtotal += totals.amount_subtotal
      totalTax += totals.amount_tax
      totalAmount += totals.amount_total
    }

    // Create checkout session
    const sessionData = {
      merchant_id: merchantId,
      mode: validatedData.mode,
      status: 'open',
      customer_id: validatedData.customer_id,
      customer_email: validatedData.customer_email,
      success_url: validatedData.success_url,
      cancel_url: validatedData.cancel_url,
      currency: validatedData.currency,
      amount_total: totalAmount,
      amount_subtotal: totalSubtotal,
      amount_tax: totalTax,
      allow_promotion_codes: validatedData.allow_promotion_codes,
      billing_address_collection: validatedData.billing_address_collection,
      shipping_address_collection: validatedData.shipping_address_collection,
      shipping_options: validatedData.shipping_options,
      automatic_tax: validatedData.automatic_tax || { enabled: false },
      tax_id_collection: validatedData.tax_id_collection || { enabled: false },
      consent_collection: validatedData.consent_collection || {},
      custom_fields: validatedData.custom_fields || [],
      expires_at: expiresAt.toISOString(),
      metadata: validatedData.metadata || {},
      locale: validatedData.locale,
      url_key: urlKey,
    }

    const { data: session, error: sessionError } = await supabase
      .from('checkout_sessions')
      .insert(sessionData)
      .select()
      .single()

    if (sessionError) {
      throw new Error(`Failed to create session: ${sessionError.message}`)
    }

    // Insert line items
    const lineItemsToInsert = lineItemsData.map(item => ({
      checkout_session_id: session.id,
      ...item,
    }))

    const { error: lineItemsError } = await supabase
      .from('checkout_line_items')
      .insert(lineItemsToInsert)

    if (lineItemsError) {
      // Rollback session creation
      await supabase
        .from('checkout_sessions')
        .delete()
        .eq('id', session.id)

      throw new Error(`Failed to create line items: ${lineItemsError.message}`)
    }

    // Get checkout URL based on environment
    const checkoutUrl = c.env.CHECKOUT_BASE_URL || 'https://checkout.deonpay.mx'
    const fullUrl = `${checkoutUrl}/session/${urlKey}`

    // Emit checkout.session.created event
    await emitEvent({
      supabase,
      merchantId,
      eventType: 'checkout.session.created',
      data: {
        ...session,
        line_items: lineItemsData,
        url: fullUrl,
      },
      env: {
        SUPABASE_URL: c.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: c.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    }).catch(err => console.error('[Checkout] Error emitting event:', err))

    return c.json({
      ...session,
      line_items: lineItemsData,
      url: fullUrl,
    }, 201)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({
        error: {
          type: 'validation_error',
          message: 'Invalid request parameters',
          details: error.errors,
        }
      }, 400)
    }

    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to create checkout session',
      }
    }, 500)
  }
})

// ============================================================================
// GET /api/v1/checkout/sessions/:id - Get checkout session
// ============================================================================
app.get('/sessions/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const sessionId = c.req.param('id')
    const query = c.req.query()

    // Parse query parameters
    const params = GetCheckoutSessionQuerySchema.parse(query)

    // Build select query with expansions
    let selectQuery = '*'
    if (params.expand?.includes('line_items')) {
      selectQuery += ', line_items:checkout_line_items(*)'
    }
    if (params.expand?.includes('payment_intent')) {
      selectQuery += ', payment_intent:payment_intents(*)'
    }
    if (params.expand?.includes('customer')) {
      selectQuery += ', customer:customers(*)'
    }

    // Get checkout session
    const { data: session, error } = await supabase
      .from('checkout_sessions')
      .select(selectQuery)
      .eq('id', sessionId)
      .eq('merchant_id', merchantId)
      .single()

    if (error || !session) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Checkout session not found',
        }
      }, 404)
    }

    // Add checkout URL
    const checkoutUrl = c.env.CHECKOUT_BASE_URL || 'https://checkout.deonpay.mx'
    const fullUrl = `${checkoutUrl}/session/${session.url_key}`

    return c.json({
      ...session,
      url: fullUrl,
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({
        error: {
          type: 'validation_error',
          message: 'Invalid query parameters',
          details: error.errors,
        }
      }, 400)
    }

    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to get checkout session',
      }
    }, 500)
  }
})

// ============================================================================
// GET /api/v1/checkout/sessions/by-url/:url_key - Get session by URL (public)
// ============================================================================
app.get('/sessions/by-url/:url_key', async (c) => {
  try {
    const supabase = c.get('supabase')
    const urlKey = c.req.param('url_key')

    console.log('[Checkout] Looking up session by url_key:', { urlKey })

    // Get checkout session with line items and merchant API keys
    const { data: session, error } = await supabase
      .from('checkout_sessions')
      .select(`
        *,
        line_items:checkout_line_items(*),
        merchant:merchants(
          id,
          name,
          support_email,
          support_phone
        )
      `)
      .eq('url_key', urlKey)
      .eq('status', 'open')
      .single()

    if (error || !session) {
      console.error('[Checkout] Session lookup failed:', {
        urlKey,
        error,
        errorMessage: error?.message,
        errorDetails: error?.details,
        errorHint: error?.hint,
        errorCode: error?.code,
      })
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Checkout session not found or expired',
        }
      }, 404)
    }

    console.log('[Checkout] Session found:', {
      id: session.id,
      url_key: session.url_key,
      merchant_id: session.merchant_id,
      has_client_secret: !!session.client_secret,
      line_items_count: session.line_items?.length || 0
    })

    // Get merchant's public key from api_keys table
    const { data: apiKey, error: keyError } = await supabase
      .from('api_keys')
      .select('public_key')
      .eq('merchant_id', session.merchant_id)
      .eq('key_type', 'public')
      .eq('is_active', true)
      .single()

    if (keyError) {
      console.warn('[Checkout] Failed to fetch public key:', {
        merchant_id: session.merchant_id,
        error: keyError
      })
    }

    console.log('[Checkout] API Key lookup:', {
      merchant_id: session.merchant_id,
      has_public_key: !!apiKey?.public_key
    })

    // Check if session has expired
    if (new Date(session.expires_at) < new Date()) {
      // Update status to expired
      await supabase
        .from('checkout_sessions')
        .update({ status: 'expired' })
        .eq('id', session.id)

      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Checkout session has expired',
        }
      }, 410) // Gone
    }

    // Don't expose sensitive merchant data to public
    const publicSession = {
      id: session.id,
      url_key: session.url_key,
      mode: session.mode,
      currency: session.currency,
      amount_total: session.amount_total,
      amount_subtotal: session.amount_subtotal,
      amount_tax: session.amount_tax,
      client_secret: session.client_secret,
      line_items: session.line_items,
      billing_address_collection: session.billing_address_collection,
      shipping_address_collection: session.shipping_address_collection,
      shipping_options: session.shipping_options,
      custom_fields: session.custom_fields,
      consent_collection: session.consent_collection,
      locale: session.locale,
      status: session.status,
      customer_email: session.customer_email,
      merchant: {
        ...session.merchant,
        public_key: apiKey?.public_key || null
      },
      expires_at: session.expires_at,
    }

    return c.json(publicSession)
  } catch (error: any) {
    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to get checkout session',
      }
    }, 500)
  }
})

// ============================================================================
// POST /api/v1/checkout/sessions/:id/complete - Complete checkout session
// ============================================================================
app.post('/sessions/:id/complete', async (c) => {
  try {
    const supabase = c.get('supabase')
    const sessionId = c.req.param('id')
    const body = await c.req.json()

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('checkout_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Checkout session not found',
        }
      }, 404)
    }

    if (session.status !== 'open') {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Checkout session is not open',
        }
      }, 400)
    }

    // Validate payment_intent_id is provided
    if (!body.payment_intent_id) {
      return c.json({
        error: {
          type: 'validation_error',
          message: 'payment_intent_id is required',
        }
      }, 400)
    }

    // Verify payment intent exists and is successful
    const { data: paymentIntent, error: piError } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', body.payment_intent_id)
      .eq('merchant_id', session.merchant_id)
      .single()

    if (piError || !paymentIntent) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Payment intent not found',
        }
      }, 404)
    }

    if (paymentIntent.status !== 'succeeded') {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Payment intent has not succeeded',
        }
      }, 400)
    }

    // Update checkout session
    const { data: updatedSession, error: updateError } = await supabase
      .from('checkout_sessions')
      .update({
        status: 'complete',
        payment_intent_id: body.payment_intent_id,
        payment_status: 'paid',
        completed_at: new Date().toISOString(),
        customer_email: body.customer_email || session.customer_email,
        customer_name: body.customer_name || session.customer_name,
        customer_phone: body.customer_phone || session.customer_phone,
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to update session: ${updateError.message}`)
    }

    // Emit checkout.session.completed event
    await emitEvent({
      supabase,
      merchantId: session.merchant_id,
      eventType: 'checkout.session.completed',
      data: updatedSession,
      env: {
        SUPABASE_URL: c.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: c.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    }).catch(err => console.error('[Checkout] Error emitting event:', err))

    return c.json(updatedSession)
  } catch (error: any) {
    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to complete checkout session',
      }
    }, 500)
  }
})

// ============================================================================
// POST /api/v1/checkout/sessions/:id/expire - Expire checkout session
// ============================================================================
app.post('/sessions/:id/expire', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const sessionId = c.req.param('id')

    // Update session status
    const { data: session, error } = await supabase
      .from('checkout_sessions')
      .update({ status: 'expired' })
      .eq('id', sessionId)
      .eq('merchant_id', merchantId)
      .eq('status', 'open')
      .select()
      .single()

    if (error || !session) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Checkout session not found or already expired',
        }
      }, 404)
    }

    return c.json(session)
  } catch (error: any) {
    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to expire checkout session',
      }
    }, 500)
  }
})

export const checkoutRouter = app