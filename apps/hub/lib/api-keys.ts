import crypto from 'crypto'

/**
 * Generate a random API key
 * Format: {prefix}_{environment}_{random}
 * Example: pk_test_1a2b3c4d5e6f7g8h9i0j
 */
export function generateApiKey(prefix: 'pk' | 'sk', environment: 'test' | 'live'): string {
  const randomBytes = crypto.randomBytes(24)
  const randomString = randomBytes.toString('base64')
    .replace(/\+/g, '')
    .replace(/\//g, '')
    .replace(/=/g, '')
    .substring(0, 32)

  return `${prefix}_${environment}_${randomString}`
}

/**
 * Hash a secret key for storage
 * Uses SHA-256 for simplicity (in production, use bcrypt)
 */
export function hashSecretKey(secretKey: string): string {
  return crypto
    .createHash('sha256')
    .update(secretKey)
    .digest('hex')
}

/**
 * Get the display prefix of a secret key (first 12 characters)
 * Example: sk_test_1a2b... -> sk_test_1a2b
 */
export function getSecretKeyPrefix(secretKey: string): string {
  return secretKey.substring(0, 16) + '...'
}

/**
 * Verify a secret key against its hash
 */
export function verifySecretKey(secretKey: string, hash: string): boolean {
  const computedHash = hashSecretKey(secretKey)
  return computedHash === hash
}

/**
 * Generate a complete set of API keys for a merchant
 */
export function generateMerchantKeys(environment: 'test' | 'live' = 'test') {
  const publicKey = generateApiKey('pk', environment)
  const secretKey = generateApiKey('sk', environment)
  const secretKeyHash = hashSecretKey(secretKey)
  const secretKeyPrefix = getSecretKeyPrefix(secretKey)

  return {
    publicKey,
    secretKey, // Only return this once during generation
    secretKeyHash,
    secretKeyPrefix,
    environment,
  }
}
