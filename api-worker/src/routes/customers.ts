/**
 * Customers Routes
 * Handles customer CRUD operations
 */

import { Hono } from 'hono'
import { CreateCustomerSchema, UpdateCustomerSchema } from '../schemas/canonical'
import type { HonoContext } from '../types/hono'

const app = new Hono<HonoContext>()

// Create customer
app.post('/', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const body = await c.req.json()

    const validatedData = CreateCustomerSchema.parse(body)

    const { data, error } = await supabase
      .from('customers')
      .insert({
        merchant_id: merchantId,
        ...validatedData,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    return c.json(data, 201)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: { type: 'validation_error', message: 'Invalid parameters', details: error.errors } }, 400)
    }
    return c.json({ error: { type: 'api_error', message: error.message } }, 500)
  }
})

// Get customer
app.get('/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const id = c.req.param('id')

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single()

    if (error || !data) {
      return c.json({ error: { type: 'invalid_request_error', message: 'Customer not found' } }, 404)
    }

    return c.json(data)
  } catch (error: any) {
    return c.json({ error: { type: 'api_error', message: error.message } }, 500)
  }
})

// List customers
app.get('/', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = parseInt(c.req.query('offset') || '0')
    const search = c.req.query('search') || ''

    // Build query
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply search filter if provided
    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    const { data, error, count } = await query

    if (error) throw new Error(error.message)

    // Get aggregated stats
    const { data: stats } = await supabase
      .from('customers')
      .select('transaction_count, created_at')
      .eq('merchant_id', merchantId)

    const totalCustomers = count || 0
    const activeCustomers = stats?.filter(c => c.transaction_count > 0).length || 0

    // Calculate new customers this month
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const newThisMonth = stats?.filter(c =>
      new Date(c.created_at) >= firstDayOfMonth
    ).length || 0

    return c.json({
      object: 'list',
      data: data || [],
      has_more: (count || 0) > offset + limit,
      pagination: {
        total: totalCustomers,
        limit,
        offset
      },
      stats: {
        total: totalCustomers,
        active: activeCustomers,
        newThisMonth
      }
    })
  } catch (error: any) {
    return c.json({ error: { type: 'api_error', message: error.message } }, 500)
  }
})

// Update customer
app.patch('/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const id = c.req.param('id')
    const body = await c.req.json()

    const validatedData = UpdateCustomerSchema.parse(body)

    const { data, error } = await supabase
      .from('customers')
      .update(validatedData)
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .select()
      .single()

    if (error || !data) {
      return c.json({ error: { type: 'invalid_request_error', message: 'Customer not found' } }, 404)
    }

    return c.json(data)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: { type: 'validation_error', message: 'Invalid parameters', details: error.errors } }, 400)
    }
    return c.json({ error: { type: 'api_error', message: error.message } }, 500)
  }
})

// Delete customer
app.delete('/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const id = c.req.param('id')

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('merchant_id', merchantId)

    if (error) {
      return c.json({ error: { type: 'invalid_request_error', message: 'Customer not found' } }, 404)
    }

    return c.json({ deleted: true, id })
  } catch (error: any) {
    return c.json({ error: { type: 'api_error', message: error.message } }, 500)
  }
})

export { app as customersRouter }
