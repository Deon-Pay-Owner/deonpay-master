/**
 * Payment Links Routes
 * Handles payment link creation and management
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types/hono'

const app = new Hono<HonoContext>()

// ============================================================================
// SCHEMAS
// ============================================================================

/**
 * Line item for payment link
 */
const PaymentLinkLineItemSchema = z.object({
  product_id: z.string().uuid().optional(),
  quantity: z.number().int().min(1).default(1),
  adjustable_quantity: z.object({
    enabled: z.boolean(),
    minimum: z.number().int().min(1).optional(),
    maximum: z.number().int().optional(),
  }).optional(),
  price_data: z.object({
    unit_amount: z.number().int().min(0),
    currency: z.string().length(3).toUpperCase().default('MXN'),
    product_data: z.object({
      name: z.string(),
      description: z.string().optional(),
      images: z.array(z.string().url()).optional(),
    }),
  }).optional(),
})

/**
 * Custom text configuration
 */
const CustomTextSchema = z.object({
  submit: z.object({
    message: z.string().optional(),
  }).optional(),
  after_submit: z.object({
    message: z.string().optional(),
  }).optional(),
})

/**
 * Restrictions configuration
 */
const RestrictionsSchema = z.object({
  completed_sessions: z.object({
    enabled: z.boolean(),
    limit: z.number().int().min(1),
  }).optional(),
})

/**
 * Payment link creation schema
 */
const CreatePaymentLinkSchema = z.object({
  line_items: z.array(PaymentLinkLineItemSchema).min(1),

  // URL configuration
  custom_url: z.string()
    .regex(/^[a-z0-9-]+$/, 'Custom URL can only contain lowercase letters, numbers, and hyphens')
    .optional(),

  // Redirect configuration
  after_completion: z.object({
    type: z.enum(['redirect', 'hosted_confirmation']).default('hosted_confirmation'),
    redirect: z.object({
      url: z.string().url(),
    }).optional(),
    hosted_confirmation: z.object({
      custom_message: z.string().optional(),
    }).optional(),
  }).optional(),

  // Payment configuration
  currency: z.string().length(3).toUpperCase().default('MXN'),
  allow_promotion_codes: z.boolean().default(false),
  payment_method_types: z.array(z.string()).optional(),

  // Collection settings
  billing_address_collection: z.enum(['auto', 'required']).optional(),
  shipping_address_collection: z.object({
    allowed_countries: z.array(z.string().length(2)),
  }).optional(),
  phone_number_collection: z.boolean().default(false),

  // Tax settings
  automatic_tax: z.object({
    enabled: z.boolean(),
  }).optional(),
  tax_id_collection: z.object({
    enabled: z.boolean(),
  }).optional(),

  // Custom fields
  custom_fields: z.array(z.object({
    key: z.string(),
    label: z.object({
      type: z.enum(['custom']),
      custom: z.string(),
    }),
    type: z.enum(['text', 'dropdown', 'numeric']),
    optional: z.boolean().default(false),
  })).optional(),

  // Custom text
  custom_text: CustomTextSchema.optional(),

  // Consent collection
  consent_collection: z.object({
    terms_of_service: z.enum(['required', 'none']).optional(),
    promotions: z.enum(['auto', 'none']).optional(),
  }).optional(),

  // Restrictions
  restrictions: RestrictionsSchema.optional(),

  // Metadata
  metadata: z.record(z.any()).optional(),

  // Active state
  active: z.boolean().default(true),
})

/**
 * Payment link update schema
 */
const UpdatePaymentLinkSchema = CreatePaymentLinkSchema.partial().omit({
  line_items: true, // Line items cannot be updated after creation
})

/**
 * Query parameters for listing payment links
 */
const ListPaymentLinksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  starting_after: z.string().uuid().optional(),
  ending_before: z.string().uuid().optional(),
  active: z.coerce.boolean().optional(),
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique URL key for payment link
 */
function generateUrlKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const randomValues = new Uint8Array(16)
  crypto.getRandomValues(randomValues)
  return Array.from(randomValues)
    .map(value => chars[value % chars.length])
    .join('')
}

/**
 * Generate QR code URL
 */
function generateQRCodeUrl(paymentLinkUrl: string): string {
  // Using QR Server API for QR code generation
  const size = 400
  const encodedUrl = encodeURIComponent(paymentLinkUrl)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=png&data=${encodedUrl}`
}

/**
 * Validate line items
 */
async function validateLineItems(
  supabase: any,
  lineItems: any[],
  merchantId: string
): Promise<void> {
  for (const item of lineItems) {
    if (item.product_id) {
      // Verify product exists and is active
      const { data: product, error } = await supabase
        .from('products')
        .select('id, active')
        .eq('id', item.product_id)
        .eq('merchant_id', merchantId)
        .single()

      if (error || !product) {
        throw new Error(`Product ${item.product_id} not found`)
      }

      if (!product.active) {
        throw new Error(`Product ${item.product_id} is not active`)
      }
    } else if (!item.price_data) {
      throw new Error('Line item must have either product_id or price_data')
    }
  }
}

// ============================================================================
// POST /api/v1/payment_links - Create payment link
// ============================================================================
app.post('/', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const body = await c.req.json()

    // Validate request body
    const validatedData = CreatePaymentLinkSchema.parse(body)

    // Validate line items
    await validateLineItems(supabase, validatedData.line_items, merchantId)

    // Check if custom URL is unique (if provided)
    if (validatedData.custom_url) {
      const { data: existing } = await supabase
        .from('payment_links')
        .select('id')
        .eq('merchant_id', merchantId)
        .eq('custom_url', validatedData.custom_url)
        .single()

      if (existing) {
        return c.json({
          error: {
            type: 'validation_error',
            message: 'Custom URL already exists',
          }
        }, 400)
      }
    }

    // Generate URL key
    const urlKey = generateUrlKey()

    // Prepare payment link data
    const paymentLinkData = {
      merchant_id: merchantId,
      url_key: urlKey,
      ...validatedData,
      after_completion_url: validatedData.after_completion?.redirect?.url,
      after_completion_message: validatedData.after_completion?.hosted_confirmation?.custom_message,
    }

    // Create payment link
    const { data: paymentLink, error } = await supabase
      .from('payment_links')
      .insert(paymentLinkData)
      .select()
      .single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    // Generate URLs
    // Use custom_url if available, otherwise use payment link ID
    const urlSlug = validatedData.custom_url || paymentLink.id
    const linkUrl = `https://link.deonpay.mx/${urlSlug}`

    // Generate QR code URL
    const qrCodeUrl = generateQRCodeUrl(linkUrl)

    // Update payment link with QR code URL
    await supabase
      .from('payment_links')
      .update({ qr_code_url: qrCodeUrl })
      .eq('id', paymentLink.id)

    return c.json({
      ...paymentLink,
      url: linkUrl,
      qr_code_url: qrCodeUrl,
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
        message: error.message || 'Failed to create payment link',
      }
    }, 500)
  }
})

// ============================================================================
// GET /api/v1/payment_links - List payment links
// ============================================================================
app.get('/', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const query = c.req.query()

    // Validate query parameters
    const params = ListPaymentLinksQuerySchema.parse(query)

    // Build query
    let dbQuery = supabase
      .from('payment_links')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })

    // Apply filters
    if (params.active !== undefined) {
      dbQuery = dbQuery.eq('active', params.active)
    }

    // Pagination
    if (params.starting_after) {
      const { data: cursor } = await supabase
        .from('payment_links')
        .select('created_at')
        .eq('id', params.starting_after)
        .single()

      if (cursor) {
        dbQuery = dbQuery.lt('created_at', cursor.created_at)
      }
    }

    if (params.ending_before) {
      const { data: cursor } = await supabase
        .from('payment_links')
        .select('created_at')
        .eq('id', params.ending_before)
        .single()

      if (cursor) {
        dbQuery = dbQuery.gt('created_at', cursor.created_at)
      }
    }

    dbQuery = dbQuery.limit(params.limit)

    // Execute query
    const { data: paymentLinks, error } = await dbQuery

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    // Add URLs to each payment link
    const baseUrl = c.env.PAYMENT_LINK_BASE_URL || 'https://pay.deonpay.mx'
    const linksWithUrls = paymentLinks.map(link => ({
      ...link,
      url: link.custom_url
        ? `${baseUrl}/l/${link.custom_url}`
        : `${baseUrl}/link/${link.url_key}`,
    }))

    // Check if there are more results
    const hasMore = paymentLinks.length === params.limit

    return c.json({
      object: 'list',
      data: linksWithUrls,
      has_more: hasMore,
      url: '/api/v1/payment_links',
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
        message: error.message || 'Failed to list payment links',
      }
    }, 500)
  }
})

// ============================================================================
// GET /api/v1/payment_links/:id - Get single payment link
// ============================================================================
app.get('/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const linkId = c.req.param('id')

    // Validate UUID format
    if (!linkId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Invalid payment link ID format',
        }
      }, 400)
    }

    // Get payment link
    const { data: paymentLink, error } = await supabase
      .from('payment_links')
      .select('*')
      .eq('id', linkId)
      .eq('merchant_id', merchantId)
      .single()

    if (error || !paymentLink) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Payment link not found',
        }
      }, 404)
    }

    // Add URL
    const baseUrl = c.env.PAYMENT_LINK_BASE_URL || 'https://pay.deonpay.mx'
    const url = paymentLink.custom_url
      ? `${baseUrl}/l/${paymentLink.custom_url}`
      : `${baseUrl}/link/${paymentLink.url_key}`

    return c.json({
      ...paymentLink,
      url,
    })
  } catch (error: any) {
    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to get payment link',
      }
    }, 500)
  }
})

// ============================================================================
// PATCH /api/v1/payment_links/:id - Update payment link
// ============================================================================
app.patch('/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const linkId = c.req.param('id')
    const body = await c.req.json()

    // Validate UUID format
    if (!linkId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Invalid payment link ID format',
        }
      }, 400)
    }

    // Validate request body
    const validatedData = UpdatePaymentLinkSchema.parse(body)

    // Check if payment link exists
    const { data: existing } = await supabase
      .from('payment_links')
      .select('id, url_key, custom_url')
      .eq('id', linkId)
      .eq('merchant_id', merchantId)
      .single()

    if (!existing) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Payment link not found',
        }
      }, 404)
    }

    // Check if custom URL is unique (if being updated)
    if (validatedData.custom_url && validatedData.custom_url !== existing.custom_url) {
      const { data: duplicate } = await supabase
        .from('payment_links')
        .select('id')
        .eq('merchant_id', merchantId)
        .eq('custom_url', validatedData.custom_url)
        .single()

      if (duplicate) {
        return c.json({
          error: {
            type: 'validation_error',
            message: 'Custom URL already exists',
          }
        }, 400)
      }
    }

    // Prepare update data
    const updateData: any = { ...validatedData }
    if (validatedData.after_completion) {
      updateData.after_completion_url = validatedData.after_completion.redirect?.url
      updateData.after_completion_message = validatedData.after_completion.hosted_confirmation?.custom_message
      delete updateData.after_completion
    }

    // Update payment link
    const { data: paymentLink, error } = await supabase
      .from('payment_links')
      .update(updateData)
      .eq('id', linkId)
      .eq('merchant_id', merchantId)
      .select()
      .single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    // Add URL
    const baseUrl = c.env.PAYMENT_LINK_BASE_URL || 'https://pay.deonpay.mx'
    const url = paymentLink.custom_url
      ? `${baseUrl}/l/${paymentLink.custom_url}`
      : `${baseUrl}/link/${paymentLink.url_key}`

    // Update QR code if URL changed
    if (validatedData.custom_url && validatedData.custom_url !== existing.custom_url) {
      const qrCodeUrl = generateQRCodeUrl(url)
      await supabase
        .from('payment_links')
        .update({ qr_code_url: qrCodeUrl })
        .eq('id', linkId)

      paymentLink.qr_code_url = qrCodeUrl
    }

    return c.json({
      ...paymentLink,
      url,
    })
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
        message: error.message || 'Failed to update payment link',
      }
    }, 500)
  }
})

// ============================================================================
// GET /api/v1/payment_links/by-url/:url_key - Get link by URL (public)
// ============================================================================
app.get('/by-url/:url_key', async (c) => {
  try {
    const supabase = c.get('supabase')
    const urlKey = c.req.param('url_key')

    // Get payment link
    let paymentLink
    let error

    // Check if it's a custom URL or regular URL key
    if (urlKey.match(/^[a-z0-9-]+$/)) {
      // Could be custom URL
      const customResult = await supabase
        .from('payment_links')
        .select(`
          *,
          merchant:merchants(
            id,
            name,
            logo_url
          )
        `)
        .eq('custom_url', urlKey)
        .eq('active', true)
        .single()

      if (!customResult.error && customResult.data) {
        paymentLink = customResult.data
      }
    }

    if (!paymentLink) {
      // Try regular URL key
      const result = await supabase
        .from('payment_links')
        .select(`
          *,
          merchant:merchants(
            id,
            name,
            logo_url
          )
        `)
        .eq('url_key', urlKey)
        .eq('active', true)
        .single()

      paymentLink = result.data
      error = result.error
    }

    if (error || !paymentLink) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Payment link not found or inactive',
        }
      }, 404)
    }

    // Track view event
    await supabase
      .from('payment_link_analytics')
      .insert({
        payment_link_id: paymentLink.id,
        event_type: 'view',
        ip_address: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        user_agent: c.req.header('User-Agent'),
        referrer: c.req.header('Referer'),
      })
      .catch(err => console.error('Failed to track view:', err))

    // Return public data
    const publicData = {
      id: paymentLink.id,
      line_items: paymentLink.line_items,
      currency: paymentLink.currency,
      allow_promotion_codes: paymentLink.allow_promotion_codes,
      billing_address_collection: paymentLink.billing_address_collection,
      shipping_address_collection: paymentLink.shipping_address_collection,
      phone_number_collection: paymentLink.phone_number_collection,
      custom_fields: paymentLink.custom_fields,
      custom_text: paymentLink.custom_text,
      consent_collection: paymentLink.consent_collection,
      merchant: paymentLink.merchant,
    }

    return c.json(publicData)
  } catch (error: any) {
    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to get payment link',
      }
    }, 500)
  }
})

// ============================================================================
// POST /api/v1/payment_links/:id/create-session - Create checkout session from link
// ============================================================================
app.post('/:id/create-session', async (c) => {
  try {
    const supabase = c.get('supabase')
    const linkId = c.req.param('id')
    const body = await c.req.json()

    // Get payment link
    const { data: paymentLink, error: linkError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('id', linkId)
      .eq('active', true)
      .single()

    if (linkError || !paymentLink) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Payment link not found or inactive',
        }
      }, 404)
    }

    // Check restrictions
    if (paymentLink.restrictions?.completed_sessions?.enabled) {
      const limit = paymentLink.restrictions.completed_sessions.limit
      if (paymentLink.completed_sessions_count >= limit) {
        return c.json({
          error: {
            type: 'invalid_request_error',
            message: 'Payment link has reached its usage limit',
          }
        }, 400)
      }
    }

    // Create checkout session from payment link configuration
    const sessionData = {
      merchant_id: paymentLink.merchant_id,
      mode: paymentLink.type === 'subscription' ? 'subscription' : 'payment',
      status: 'open',
      customer_email: body.customer_email,
      success_url: paymentLink.after_completion_url || 'https://pay.deonpay.mx/success',
      cancel_url: 'https://pay.deonpay.mx/cancel',
      currency: paymentLink.currency,
      allow_promotion_codes: paymentLink.allow_promotion_codes,
      billing_address_collection: paymentLink.billing_address_collection,
      shipping_address_collection: paymentLink.shipping_address_collection,
      automatic_tax: paymentLink.automatic_tax || { enabled: false },
      tax_id_collection: paymentLink.tax_id_collection || { enabled: false },
      consent_collection: paymentLink.consent_collection || {},
      custom_fields: paymentLink.custom_fields || [],
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        ...paymentLink.metadata,
        payment_link_id: linkId,
      },
      locale: body.locale || 'es',
      url_key: generateUrlKey(),
    }

    // Start transaction
    const { data: session, error: sessionError } = await supabase
      .from('checkout_sessions')
      .insert(sessionData)
      .select()
      .single()

    if (sessionError) {
      throw new Error(`Failed to create checkout session: ${sessionError.message}`)
    }

    // Process line items
    const lineItemsData = []
    let totalSubtotal = 0
    let totalAmount = 0

    for (const item of paymentLink.line_items) {
      let unitAmount, name, description, images

      if (item.product_id) {
        // Fetch product details
        const { data: product } = await supabase
          .from('products')
          .select('*')
          .eq('id', item.product_id)
          .single()

        if (product) {
          unitAmount = product.unit_amount
          name = product.name
          description = product.description
          images = product.images || []
        }
      } else if (item.price_data) {
        unitAmount = item.price_data.unit_amount
        name = item.price_data.product_data.name
        description = item.price_data.product_data.description
        images = item.price_data.product_data.images || []
      }

      const quantity = body.quantities?.[item.product_id || 'custom'] || item.quantity || 1
      const subtotal = unitAmount * quantity
      const total = subtotal // TODO: Add tax calculation

      lineItemsData.push({
        checkout_session_id: session.id,
        product_id: item.product_id,
        price_data: item.price_data,
        quantity,
        amount_subtotal: subtotal,
        amount_total: total,
        amount_tax: 0,
        name,
        description,
        images,
      })

      totalSubtotal += subtotal
      totalAmount += total
    }

    // Insert line items
    const { error: lineItemsError } = await supabase
      .from('checkout_line_items')
      .insert(lineItemsData)

    if (lineItemsError) {
      // Rollback
      await supabase
        .from('checkout_sessions')
        .delete()
        .eq('id', session.id)

      throw new Error(`Failed to create line items: ${lineItemsError.message}`)
    }

    // Update totals
    await supabase
      .from('checkout_sessions')
      .update({
        amount_subtotal: totalSubtotal,
        amount_total: totalAmount,
        amount_tax: 0,
      })
      .eq('id', session.id)

    // Track checkout started event
    await supabase
      .from('payment_link_analytics')
      .insert({
        payment_link_id: linkId,
        checkout_session_id: session.id,
        event_type: 'checkout_started',
        session_id: body.session_id,
        ip_address: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        user_agent: c.req.header('User-Agent'),
      })
      .catch(err => console.error('Failed to track checkout started:', err))

    // Increment click count
    await supabase.rpc('increment_payment_link_stats', {
      p_link_id: linkId,
      p_event_type: 'click',
    })

    // Get checkout URL
    const checkoutUrl = c.env.CHECKOUT_BASE_URL || 'https://checkout.deonpay.mx'
    const fullUrl = `${checkoutUrl}/session/${session.url_key}`

    return c.json({
      ...session,
      line_items: lineItemsData,
      url: fullUrl,
    }, 201)
  } catch (error: any) {
    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to create checkout session',
      }
    }, 500)
  }
})

export const paymentLinksRouter = app