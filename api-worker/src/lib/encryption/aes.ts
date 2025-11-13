/**
 * AES Encryption Service
 * Encrypts and decrypts sensitive data using AES-256-GCM
 */

/**
 * Encrypts data using AES-256-GCM
 * @param plaintext - Data to encrypt
 * @param key - Encryption key (32 bytes for AES-256)
 * @returns Base64-encoded encrypted data with IV and auth tag
 */
export async function encryptAES(plaintext: string, key: string): Promise<string> {
  // Convert key to CryptoKey
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32))

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Encrypt data
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    cryptoKey,
    encoder.encode(plaintext)
  )

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)

  // Return base64-encoded
  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypts AES-256-GCM encrypted data
 * @param ciphertext - Base64-encoded encrypted data
 * @param key - Encryption key (32 bytes for AES-256)
 * @returns Decrypted plaintext
 */
export async function decryptAES(ciphertext: string, key: string): Promise<string> {
  try {
    // Decode base64
    const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))

    // Extract IV (first 12 bytes)
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)

    // Convert key to CryptoKey
    const encoder = new TextEncoder()
    const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32))

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    )

    // Decrypt data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      cryptoKey,
      encrypted
    )

    // Convert to string
    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (error) {
    throw new Error('Decryption failed')
  }
}

/**
 * Generates a secure random encryption key
 * @returns Base64-encoded 32-byte key
 */
export function generateEncryptionKey(): string {
  const key = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...key))
}
