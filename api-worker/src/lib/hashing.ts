/**
 * Hashing Utilities
 * For body hashing in idempotency checks
 */

/**
 * Compute SHA-256 hash of a JSON body
 * Returns hex-encoded hash string
 */
export async function computeBodyHash(body: any): Promise<string> {
  // Canonize JSON (stringify with sorted keys)
  const canonical = JSON.stringify(body, Object.keys(body).sort())

  // Convert string to Uint8Array
  const encoder = new TextEncoder()
  const data = encoder.encode(canonical)

  // Compute SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return hashHex
}

/**
 * Normalize JSON for consistent hashing
 * Sorts keys recursively
 */
export function canonizeJson(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(canonizeJson).join(',') + ']'
  }

  const keys = Object.keys(obj).sort()
  const pairs = keys.map(k => `"${k}":${canonizeJson(obj[k])}`)
  return '{' + pairs.join(',') + '}'
}
