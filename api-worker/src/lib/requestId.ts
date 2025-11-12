/**
 * Request ID Generation
 * Generates unique request IDs for tracing
 */

/**
 * Generate a request ID with format: req_<random>
 * Uses crypto.randomUUID() when available, falls back to manual generation
 */
export function generateRequestId(): string {
  // Use crypto.randomUUID if available (modern environments)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `req_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`
  }

  // Fallback: generate random string
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = 'req_'
  for (let i = 0; i < 24; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}
