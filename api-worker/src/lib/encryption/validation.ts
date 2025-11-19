/**
 * Encryption Key Validation
 * Ensures encryption keys meet security requirements before use
 */

export function validateEncryptionKey(key: string | undefined): string {
  if (!key || key === 'default-dev-key-change-in-production') {
    throw new Error(
      'ENCRYPTION_KEY must be set to a secure value in production. ' +
      'Generate one with: openssl rand -base64 32'
    )
  }

  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters')
  }

  return key
}
