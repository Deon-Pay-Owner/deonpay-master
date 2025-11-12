/**
 * Idempotency Middleware
 * Handles Idempotency-Key header for POST/PATCH requests
 * Prevents duplicate processing of identical requests
 */

import { IdempotencyStore } from '../lib/idempotencyStore'
import { computeBodyHash } from '../lib/hashing'
import { errorResponse, idempotencyConflictError } from '../lib/errors'
import type { MiddlewareHandler } from 'hono'

export const idempotencyMiddleware: MiddlewareHandler = async (c, next) => {
  // Only apply to mutating methods
  if (c.req.method !== 'POST' && c.req.method !== 'PATCH') {
    return await next()
  }

  const idempotencyKey = c.req.header('Idempotency-Key')
  if (!idempotencyKey) {
    // No idempotency key - allow request but log warning
    const requestId = c.get('requestId') || 'unknown'
    console.warn(`[${requestId}] No idempotency key provided for ${c.req.method} ${c.req.path}`)
    return await next()
  }

  const merchantId = c.get('merchantId')
  if (!merchantId) {
    // No merchant - skip (shouldn't happen after auth)
    return await next()
  }

  const endpoint = c.req.path

  // Get request body and compute hash
  let body: any
  try {
    const rawBody = await c.req.text()
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch (err) {
    // Invalid JSON - let the handler deal with it
    return await next()
  }

  const bodyHash = await computeBodyHash(body)

  // Initialize store
  const store = new IdempotencyStore(
    c.get('supabase'),
    c.env.IDEMPOTENCY_KV,
    parseInt(c.env.IDEMPOTENCY_TTL_SECONDS || '86400')
  )

  // Check for existing record
  const existing = await store.get(merchantId, endpoint, idempotencyKey)

  if (existing) {
    // Found existing record
    if (existing.body_hash !== bodyHash) {
      // Same key but different body = conflict
      return errorResponse(c, idempotencyConflictError(), 409)
    }

    // Same key and same body = return cached response
    c.header('Idempotency-Replayed', 'true')

    // Restore headers (except Set-Cookie for security)
    Object.entries(existing.headers).forEach(([key, value]) => {
      if (!key.toLowerCase().startsWith('set-cookie')) {
        c.header(key, value)
      }
    })

    return c.json(existing.response, existing.status as any)
  }

  // No existing record - process normally
  // Restore body for handler
  // Restore body for handler (handled by middleware)

  await next()

  // After processing, store the result
  try {
    // Clone response to read body
    const responseClone = c.res.clone()
    let responseBody: any

    try {
      responseBody = await responseClone.json()
    } catch {
      // Not JSON - skip storing
      return
    }

    // Only store successful responses (2xx and expected errors)
    if (c.res.status < 500) {
      await store.set({
        merchant_id: merchantId,
        endpoint,
        idempotency_key: idempotencyKey,
        body_hash: bodyHash,
        status: c.res.status,
        response: responseBody,
        headers: Object.fromEntries(
          Array.from(c.res.headers.entries()).filter(
            ([key]) => !key.toLowerCase().startsWith('set-cookie')
          )
        ),
      })
    }
  } catch (err) {
    // Log error but don't fail the request
    const requestId = c.get('requestId') || 'unknown'
    console.error(`[${requestId}] Failed to store idempotency record:`, err)
  }
}
