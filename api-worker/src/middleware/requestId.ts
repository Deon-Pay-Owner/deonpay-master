/**
 * Request ID Middleware
 * Generates or extracts unique request ID for tracing
 */

import { generateRequestId } from '../lib/requestId'
import type { MiddlewareHandler } from 'hono'

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  // Use existing X-Request-ID if provided, otherwise generate new one
  const requestId = c.req.header('X-Request-ID') || generateRequestId()

  // Attach to context for use in other middlewares/handlers
  c.set('requestId', requestId)

  // Process request
  await next()

  // Add request ID to response headers
  c.header('X-Request-ID', requestId)
}
