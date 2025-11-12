/**
 * Canonical Error Helpers
 * Standardized error responses following the DeonPay API spec
 */

import type { Context } from 'hono'

export type ErrorType =
  | 'card_declined'
  | 'insufficient_funds'
  | 'stolen_card'
  | 'invalid_cvc'
  | 'invalid_number'
  | 'processing_error'
  | 'rate_limited'
  | 'auth_required'
  | 'invalid_request'
  | 'not_found'
  | 'unauthorized'
  | 'conflict'
  | 'api_error'

export interface CanonicalError {
  type: ErrorType
  code: string
  message: string
  acquirer_code?: string
  acquirer_message?: string
  request_id: string
  param?: string  // For validation errors
}

/**
 * Return canonical error response
 */
export function errorResponse(c: Context, error: Partial<CanonicalError>, httpStatus = 400) {
  const requestId = c.get('requestId') || 'unknown'

  const canonicalError: CanonicalError = {
    type: error.type || 'api_error',
    code: error.code || error.type || 'unknown_error',
    message: error.message || 'An error occurred',
    request_id: requestId,
    ...(error.acquirer_code && { acquirer_code: error.acquirer_code }),
    ...(error.acquirer_message && { acquirer_message: error.acquirer_message }),
    ...(error.param && { param: error.param }),
  }

  return c.json({ error: canonicalError }, httpStatus as any)
}

/**
 * Common error constructors
 */

export function invalidRequestError(message: string, param?: string): Partial<CanonicalError> {
  return {
    type: 'invalid_request',
    code: 'invalid_request',
    message,
    param,
  }
}

export function notFoundError(message = 'Resource not found'): Partial<CanonicalError> {
  return {
    type: 'not_found',
    code: 'not_found',
    message,
  }
}

export function unauthorizedError(message = 'Unauthorized'): Partial<CanonicalError> {
  return {
    type: 'unauthorized',
    code: 'unauthorized',
    message,
  }
}

export function rateLimitedError(): Partial<CanonicalError> {
  return {
    type: 'rate_limited',
    code: 'rate_limited',
    message: 'Too many requests. Try again later.',
  }
}

export function conflictError(message: string, code = 'conflict'): Partial<CanonicalError> {
  return {
    type: 'conflict',
    code,
    message,
  }
}

export function idempotencyConflictError(): Partial<CanonicalError> {
  return {
    type: 'conflict',
    code: 'idempotency_key_conflict',
    message: 'Idempotency key already used with different parameters',
  }
}

export function processingError(message: string, acquirer_code?: string, acquirer_message?: string): Partial<CanonicalError> {
  return {
    type: 'processing_error',
    code: 'processing_error',
    message,
    acquirer_code,
    acquirer_message,
  }
}

/**
 * Map Zod validation errors to canonical format
 */
export function zodErrorToCanonical(zodError: any): Partial<CanonicalError> {
  const firstError = zodError.errors?.[0]
  return {
    type: 'invalid_request',
    code: 'invalid_request',
    message: firstError?.message || 'Invalid request parameters',
    param: firstError?.path?.join('.'),
  }
}
