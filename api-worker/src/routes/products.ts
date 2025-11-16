/**
 * Products Routes
 * Handles product catalog management for merchants
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoContext } from '../types/hono'

const app = new Hono<HonoContext>()

// ============================================================================
// SCHEMAS
// ============================================================================

/**
 * Product creation schema
 */
const CreateProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  unit_amount: z.number().int().min(0),
  currency: z.string().length(3).toUpperCase().default('MXN'),
  type: z.enum(['one_time', 'recurring']).default('one_time'),
  recurring_interval: z.enum(['day', 'week', 'month', 'year']).optional(),
  recurring_interval_count: z.number().int().min(1).optional(),
  inventory_type: z.enum(['infinite', 'finite', 'bucket']).default('infinite'),
  inventory_quantity: z.number().int().min(0).optional(),
  images: z.array(z.string().url()).default([]),
  metadata: z.record(z.any()).default({}),
  tax_code: z.string().optional(),
  statement_descriptor: z.string().max(22).optional(),
  unit_label: z.string().optional(),
  active: z.boolean().default(true),
})

/**
 * Product update schema
 */
const UpdateProductSchema = CreateProductSchema.partial()

/**
 * Price tier schema for volume pricing
 */
const PriceTierSchema = z.object({
  up_to: z.number().int().nullable(),
  unit_amount: z.number().int().min(0),
  flat_amount: z.number().int().min(0).optional(),
})

/**
 * Query parameters for listing products
 */
const ListProductsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  starting_after: z.string().uuid().optional(),
  ending_before: z.string().uuid().optional(),
  active: z.coerce.boolean().optional(),
  type: z.enum(['one_time', 'recurring']).optional(),
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a URL-friendly slug from product name
 */
async function generateSlug(supabase: any, merchantId: string, name: string): Promise<string> {
  const { data, error } = await supabase.rpc('generate_product_slug', {
    p_name: name,
    p_merchant_id: merchantId,
  })

  if (error) {
    console.error('Error generating slug:', error)
    // Fallback to simple slug generation
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return `${baseSlug}-${Date.now()}`
  }

  return data
}

/**
 * Validate recurring product settings
 */
function validateRecurringSettings(data: any) {
  if (data.type === 'recurring') {
    if (!data.recurring_interval || !data.recurring_interval_count) {
      throw new Error('Recurring products must have interval and interval_count')
    }
  } else if (data.type === 'one_time') {
    if (data.recurring_interval || data.recurring_interval_count) {
      throw new Error('One-time products cannot have recurring settings')
    }
  }
}

/**
 * Validate inventory settings
 */
function validateInventorySettings(data: any) {
  if (data.inventory_type === 'finite' || data.inventory_type === 'bucket') {
    if (data.inventory_quantity === undefined || data.inventory_quantity === null) {
      throw new Error('Finite inventory requires inventory_quantity')
    }
  }
}

// ============================================================================
// POST /api/v1/products - Create product
// ============================================================================
app.post('/', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const body = await c.req.json()

    // Validate request body
    const validatedData = CreateProductSchema.parse(body)

    // Additional validations
    validateRecurringSettings(validatedData)
    validateInventorySettings(validatedData)

    // Generate slug
    const slug = await generateSlug(supabase, merchantId, validatedData.name)

    // Create product in database
    const { data: product, error } = await supabase
      .from('products')
      .insert({
        merchant_id: merchantId,
        ...validatedData,
        slug,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    // Handle price tiers if provided
    if (body.price_tiers && Array.isArray(body.price_tiers)) {
      const tiersData = body.price_tiers.map((tier: any) => ({
        product_id: product.id,
        ...PriceTierSchema.parse(tier),
      }))

      const { error: tiersError } = await supabase
        .from('product_price_tiers')
        .insert(tiersData)

      if (tiersError) {
        console.error('Error creating price tiers:', tiersError)
        // Don't fail the whole request, tiers can be added later
      }
    }

    return c.json(product, 201)
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
        message: error.message || 'Failed to create product',
      }
    }, 500)
  }
})

// ============================================================================
// GET /api/v1/products - List products
// ============================================================================
app.get('/', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const query = c.req.query()

    // Validate query parameters
    const params = ListProductsQuerySchema.parse(query)

    // Build query
    let dbQuery = supabase
      .from('products')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })

    // Apply filters
    if (params.active !== undefined) {
      dbQuery = dbQuery.eq('active', params.active)
    }

    if (params.type) {
      dbQuery = dbQuery.eq('type', params.type)
    }

    // Pagination
    if (params.starting_after) {
      const { data: cursor } = await supabase
        .from('products')
        .select('created_at')
        .eq('id', params.starting_after)
        .single()

      if (cursor) {
        dbQuery = dbQuery.lt('created_at', cursor.created_at)
      }
    }

    if (params.ending_before) {
      const { data: cursor } = await supabase
        .from('products')
        .select('created_at')
        .eq('id', params.ending_before)
        .single()

      if (cursor) {
        dbQuery = dbQuery.gt('created_at', cursor.created_at)
      }
    }

    dbQuery = dbQuery.limit(params.limit)

    // Execute query
    const { data: products, error } = await dbQuery

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    // Check if there are more results
    const hasMore = products.length === params.limit

    return c.json({
      object: 'list',
      data: products,
      has_more: hasMore,
      url: '/api/v1/products',
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
        message: error.message || 'Failed to list products',
      }
    }, 500)
  }
})

// ============================================================================
// GET /api/v1/products/:id - Get single product
// ============================================================================
app.get('/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const productId = c.req.param('id')

    // Validate UUID format
    if (!productId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Invalid product ID format',
        }
      }, 400)
    }

    // Get product with price tiers
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        price_tiers:product_price_tiers(*)
      `)
      .eq('id', productId)
      .eq('merchant_id', merchantId)
      .single()

    if (error || !product) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Product not found',
        }
      }, 404)
    }

    return c.json(product)
  } catch (error: any) {
    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to get product',
      }
    }, 500)
  }
})

// ============================================================================
// PATCH /api/v1/products/:id - Update product
// ============================================================================
app.patch('/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const productId = c.req.param('id')
    const body = await c.req.json()

    // Validate UUID format
    if (!productId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Invalid product ID format',
        }
      }, 400)
    }

    // Validate request body
    const validatedData = UpdateProductSchema.parse(body)

    // Check if product exists
    const { data: existing } = await supabase
      .from('products')
      .select('id, type')
      .eq('id', productId)
      .eq('merchant_id', merchantId)
      .single()

    if (!existing) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Product not found',
        }
      }, 404)
    }

    // Additional validations
    if (validatedData.type !== undefined || validatedData.recurring_interval !== undefined || validatedData.recurring_interval_count !== undefined) {
      const mergedData = { ...existing, ...validatedData }
      validateRecurringSettings(mergedData)
    }

    if (validatedData.inventory_type !== undefined || validatedData.inventory_quantity !== undefined) {
      validateInventorySettings(validatedData)
    }

    // Update product
    const { data: product, error } = await supabase
      .from('products')
      .update(validatedData)
      .eq('id', productId)
      .eq('merchant_id', merchantId)
      .select()
      .single()

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    // Handle price tiers update if provided
    if (body.price_tiers !== undefined) {
      // Delete existing tiers
      await supabase
        .from('product_price_tiers')
        .delete()
        .eq('product_id', productId)

      // Insert new tiers
      if (Array.isArray(body.price_tiers) && body.price_tiers.length > 0) {
        const tiersData = body.price_tiers.map((tier: any) => ({
          product_id: productId,
          ...PriceTierSchema.parse(tier),
        }))

        const { error: tiersError } = await supabase
          .from('product_price_tiers')
          .insert(tiersData)

        if (tiersError) {
          console.error('Error updating price tiers:', tiersError)
        }
      }
    }

    return c.json(product)
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
        message: error.message || 'Failed to update product',
      }
    }, 500)
  }
})

// ============================================================================
// DELETE /api/v1/products/:id - Delete product
// ============================================================================
app.delete('/:id', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')
    const productId = c.req.param('id')

    // Validate UUID format
    if (!productId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Invalid product ID format',
        }
      }, 400)
    }

    // Soft delete (set active to false) instead of hard delete
    // This preserves historical data and references
    const { data: product, error } = await supabase
      .from('products')
      .update({ active: false })
      .eq('id', productId)
      .eq('merchant_id', merchantId)
      .select()
      .single()

    if (error || !product) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Product not found',
        }
      }, 404)
    }

    return c.json({
      id: productId,
      object: 'product',
      deleted: true,
    })
  } catch (error: any) {
    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to delete product',
      }
    }, 500)
  }
})

// ============================================================================
// GET /api/v1/products/by-slug/:slug - Get product by slug (public)
// ============================================================================
app.get('/by-slug/:slug', async (c) => {
  try {
    const supabase = c.get('supabase')
    const slug = c.req.param('slug')
    const merchantId = c.req.query('merchant_id')

    if (!merchantId) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'merchant_id query parameter is required',
        }
      }, 400)
    }

    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        price_tiers:product_price_tiers(*)
      `)
      .eq('slug', slug)
      .eq('merchant_id', merchantId)
      .eq('active', true)
      .single()

    if (error || !product) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Product not found',
        }
      }, 404)
    }

    return c.json(product)
  } catch (error: any) {
    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to get product',
      }
    }, 500)
  }
})

export const productsRouter = app