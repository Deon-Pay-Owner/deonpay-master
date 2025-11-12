/**
 * Request Log Middleware
 * Logs all requests to session_logs table
 * Fires asynchronously to not block response
 */

import type { MiddlewareHandler } from 'hono'

export const requestLogMiddleware: MiddlewareHandler = async (c, next) => {
  const startTime = Date.now()
  const requestId = c.get('requestId') || 'unknown'
  const merchantId = c.get('merchantId') || null

  // Process request
  await next()

  // Calculate duration
  const duration = Date.now() - startTime

  // Get Supabase client
  const supabase = c.get('supabase')
  if (!supabase) {
    return
  }

  // Log request (fire and forget - don't await)
  supabase
    .from('session_logs')
    .insert({
      request_id: requestId,
      merchant_id: merchantId,
      route: c.req.path,
      method: c.req.method,
      status: c.res.status,
      duration_ms: duration,
      ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null,
      user_agent: c.req.header('User-Agent') || null,
      idempotency_key: c.req.header('Idempotency-Key') || null,
    })
    .then((result: { error: any }) => {
      if (result.error) {
        console.error(`[${requestId}] Failed to log request:`, result.error)
      }
    })
}
