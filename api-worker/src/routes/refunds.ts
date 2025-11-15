/**
 * Refunds Routes
 * Handles refund creation and retrieval
 */

import { Hono } from 'hono'
import { CreateRefundSchema } from '../schemas/canonical'
import type { HonoContext } from '../types/hono'
import { refundCharge } from '../router'

const app = new Hono<HonoContext>()

// Create refund
app.post('/', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const requestId = c.get('requestId')
    const body = await c.req.json()

    const validatedData = CreateRefundSchema.parse(body)

    // Get the charge to refund
    const { data: charge } = await supabase
      .from('charges')
      .select('*')
      .eq('id', validatedData.charge_id)
      .eq('merchant_id', merchantId)
      .single()

    if (!charge) {
      return c.json({ error: { type: 'invalid_request_error', message: 'Charge not found' } }, 404)
    }

    // Determine refund amount (full or partial)
    const refundAmount = validatedData.amount || (charge.amount_captured - charge.amount_refunded)

    // Check if refund amount is valid
    if (refundAmount > (charge.amount_captured - charge.amount_refunded)) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Refund amount exceeds available balance',
          code: 'invalid_amount',
        }
      }, 400)
    }

    // Call the router to process refund through the actual acquirer adapter
    const result = await refundCharge({
      supabase,
      chargeId: validatedData.charge_id,
      merchantId,
      requestId,
      amount: refundAmount,
      reason: validatedData.reason,
      metadata: validatedData.metadata,
      env: {
        DEFAULT_ADAPTER: c.env.DEFAULT_ADAPTER || 'mock',
        SUPABASE_URL: c.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: c.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    })

    if (!result.success) {
      return c.json({
        error: {
          type: 'api_error',
          message: result.error || 'Refund failed',
        }
      }, 500)
    }

    return c.json(result.refund, 201)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: { type: 'validation_error', message: 'Invalid parameters', details: error.errors } }, 400)
    }
    return c.json({ error: { type: 'api_error', message: error.message } }, 500)
  }
})

// Get refund
app.get('/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const id = c.req.param('id')

    const { data, error } = await supabase
      .from('refunds')
      .select('*')
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single()

    if (error || !data) {
      return c.json({ error: { type: 'invalid_request_error', message: 'Refund not found' } }, 404)
    }

    return c.json(data)
  } catch (error: any) {
    return c.json({ error: { type: 'api_error', message: error.message } }, 500)
  }
})

// List refunds
app.get('/', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const limit = parseInt(c.req.query('limit') || '10')
    const offset = parseInt(c.req.query('offset') || '0')

    const { data, error, count } = await supabase
      .from('refunds')
      .select('*', { count: 'exact' })
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new Error(error.message)

    return c.json({ object: 'list', data: data || [], has_more: (count || 0) > offset + limit, total_count: count || 0 })
  } catch (error: any) {
    return c.json({ error: { type: 'api_error', message: error.message } }, 500)
  }
})

export { app as refundsRouter }
