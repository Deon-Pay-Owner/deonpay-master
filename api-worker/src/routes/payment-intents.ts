/**
 * Payment Intents Routes
 * Handles payment intent creation, confirmation, capture, and cancellation
 */

import { Hono } from 'hono'
import {
  CreatePaymentIntentSchema,
  UpdatePaymentIntentSchema,
  ConfirmPaymentIntentSchema,
  CapturePaymentIntentSchema,
} from '../schemas/canonical'
import { confirmPaymentIntent, captureCharge } from '../router'
import { processRawCardData } from '../utils/card'

const app = new Hono()

// ============================================================================
// POST /api/v1/payment_intents - Create payment intent
// ============================================================================
app.post('/', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const body = await c.req.json()

    // Validate request body
    const validatedData = CreatePaymentIntentSchema.parse(body)

    // Create payment intent in database
    const { data, error } = await supabase
      .from('payment_intents')
      .insert({
        merchant_id: merchantId,
        ...validatedData,
        status: 'requires_payment_method',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return c.json(data, 201)

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
        message: error.message || 'Failed to create payment intent',
      }
    }, 500)
  }
})

// ============================================================================
// GET /api/v1/payment_intents/:id - Get payment intent
// ============================================================================
app.get('/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const id = c.req.param('id')

    const { data, error } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single()

    if (error || !data) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Payment intent not found',
          code: 'resource_not_found',
        }
      }, 404)
    }

    return c.json(data)

  } catch (error: any) {
    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to retrieve payment intent',
      }
    }, 500)
  }
})

// ============================================================================
// GET /api/v1/payment_intents - List payment intents
// ============================================================================
app.get('/', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')

    // Query params for pagination
    const limit = parseInt(c.req.query('limit') || '10')
    const offset = parseInt(c.req.query('offset') || '0')

    const { data, error, count } = await supabase
      .from('payment_intents')
      .select('*', { count: 'exact' })
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return c.json({
      object: 'list',
      data: data || [],
      has_more: (count || 0) > offset + limit,
      total_count: count || 0,
    })

  } catch (error: any) {
    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to list payment intents',
      }
    }, 500)
  }
})

// ============================================================================
// PATCH /api/v1/payment_intents/:id - Update payment intent
// ============================================================================
app.patch('/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const id = c.req.param('id')
    const body = await c.req.json()

    // Validate request body
    const validatedData = UpdatePaymentIntentSchema.parse(body)

    // Check if payment intent exists and belongs to merchant
    const { data: existing } = await supabase
      .from('payment_intents')
      .select('id, status')
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single()

    if (!existing) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Payment intent not found',
          code: 'resource_not_found',
        }
      }, 404)
    }

    // Can't update succeeded/canceled intents
    if (['succeeded', 'canceled'].includes(existing.status)) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: `Cannot update payment intent with status: ${existing.status}`,
          code: 'invalid_state',
        }
      }, 400)
    }

    // Update payment intent
    const { data, error } = await supabase
      .from('payment_intents')
      .update(validatedData)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select()
      .single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return c.json(data)

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
        message: error.message || 'Failed to update payment intent',
      }
    }, 500)
  }
})

// ============================================================================
// POST /api/v1/payment_intents/:id/confirm - Confirm payment intent
// ============================================================================
app.post('/:id/confirm', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const requestId = c.get('requestId')
    const id = c.req.param('id')
    const body = await c.req.json()

    // Validate request body
    const { payment_method: rawPaymentMethod, billing_details } = ConfirmPaymentIntentSchema.parse(body)

    // Process raw card data to extract brand and last4 (for display purposes only)
    const processedPaymentMethod = processRawCardData(rawPaymentMethod)

    // Update payment intent with processed payment method (for display only - NOT the full card data)
    const { data: updatedPI, error: updateError } = await supabase
      .from('payment_intents')
      .update({ payment_method: processedPaymentMethod })
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select()
      .single()

    if (updateError || !updatedPI) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Payment intent not found',
          code: 'resource_not_found',
        }
      }, 404)
    }

    // Use router to process payment (pass raw payment method - NOT stored in DB)
    const result = await confirmPaymentIntent({
      supabase,
      paymentIntentId: id,
      merchantId,
      requestId,
      rawPaymentMethod,           // Pass raw card data to router
      billingDetails: billing_details,  // Pass billing details to router
      env: {
        DEFAULT_ADAPTER: c.env.DEFAULT_ADAPTER || 'mock',
      },
    })

    // Handle requires_action (3DS)
    if (result.requiresAction) {
      return c.json({
        ...result.paymentIntent,
        next_action: {
          type: 'redirect_to_url',
          redirect_to_url: {
            url: result.redirectUrl,
            return_url: body.return_url, // Merchant should provide this
          },
        },
      })
    }

    // Return successful result
    return c.json(result.paymentIntent)

  } catch (error: any) {
    console.error('[Payment Intents] Confirm error:', error)

    if (error.name === 'ZodError') {
      return c.json({
        error: {
          type: 'validation_error',
          message: 'Invalid payment method',
          details: error.errors,
        }
      }, 400)
    }

    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to confirm payment intent',
      }
    }, 500)
  }
})

// ============================================================================
// POST /api/v1/payment_intents/:id/capture - Capture payment
// ============================================================================
app.post('/:id/capture', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const requestId = c.get('requestId')
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))

    // Validate request body (optional amount_to_capture)
    const { amount_to_capture } = CapturePaymentIntentSchema.parse(body)

    // Get payment intent and associated charge
    const { data: paymentIntent } = await supabase
      .from('payment_intents')
      .select('*, charges(*)')
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single()

    if (!paymentIntent) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Payment intent not found',
          code: 'resource_not_found',
        }
      }, 404)
    }

    // Find authorized charge
    const charge = paymentIntent.charges?.find((c: any) => c.status === 'authorized')

    if (!charge) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'No authorized charge found',
          code: 'invalid_state',
        }
      }, 400)
    }

    // Use router to capture charge
    const result = await captureCharge({
      supabase,
      chargeId: charge.id,
      merchantId,
      requestId,
      amountToCapture: amount_to_capture,
      env: {
        DEFAULT_ADAPTER: c.env.DEFAULT_ADAPTER || 'mock',
      },
    })

    return c.json(result.paymentIntent)

  } catch (error: any) {
    console.error('[Payment Intents] Capture error:', error)

    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to capture payment',
      }
    }, 500)
  }
})

// ============================================================================
// POST /api/v1/payment_intents/:id/cancel - Cancel payment intent
// ============================================================================
app.post('/:id/cancel', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const id = c.req.param('id')

    // Get payment intent
    const { data: paymentIntent } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single()

    if (!paymentIntent) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Payment intent not found',
          code: 'resource_not_found',
        }
      }, 404)
    }

    // Can't cancel succeeded intents
    if (paymentIntent.status === 'succeeded') {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Cannot cancel succeeded payment intent. Use refunds instead.',
          code: 'invalid_state',
        }
      }, 400)
    }

    // Update status to canceled
    const { data: canceledIntent } = await supabase
      .from('payment_intents')
      .update({ status: 'canceled' })
      .eq('id', id)
      .select()
      .single()

    return c.json(canceledIntent)

  } catch (error: any) {
    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to cancel payment intent',
      }
    }, 500)
  }
})

export { app as paymentIntentsRouter }
