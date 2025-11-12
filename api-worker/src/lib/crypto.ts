/**
 * Crypto utilities for API key validation
 */

/**
 * Hash a secret key using SHA-256
 * This must match the hash function used in the dashboard
 */
export async function hashSecretKey(secretKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(secretKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * Determine if an API key is a secret key (starts with sk_)
 */
export function isSecretKey(apiKey: string): boolean {
  return apiKey.startsWith('sk_')
}

/**
 * Determine if an API key is a public key (starts with pk_)
 */
export function isPublicKey(apiKey: string): boolean {
  return apiKey.startsWith('pk_')
}
