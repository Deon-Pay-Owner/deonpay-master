/**
 * Token Management Service
 * Handles retrieval and consumption of card tokens
 */

import { decryptAES } from './aes'

export interface CardData {
  number: string
  exp_month: number
  exp_year: number
  cvv: string
  brand: string
}

export interface TokenData {
  encrypted_card: string
  billing_details?: any
  created_at: number
  used: boolean
}

/**
 * Retrieves and consumes a card token
 * @param tokenId - Token ID
 * @param kv - Cloudflare KV namespace (optional, falls back to global)
 * @param encryptionKey - Encryption key for decryption
 * @returns Card data or null if token not found/expired/used
 */
export async function consumeToken(
  tokenId: string,
  kv: any,
  encryptionKey: string
): Promise<CardData | null> {
  try {
    // Retrieve token from KV or global storage
    let tokenData: TokenData | null = null

    if (kv) {
      const stored = await kv.get(tokenId)
      if (stored) {
        tokenData = JSON.parse(stored)
      }
    } else {
      // Fallback to global storage for development
      if (typeof globalThis !== 'undefined' && (globalThis as any).tokenStore) {
        tokenData = (globalThis as any).tokenStore.get(tokenId)
      }
    }

    if (!tokenData) {
      console.log(`[Tokens] Token not found: ${tokenId}`)
      return null
    }

    // Check if token was already used
    if (tokenData.used) {
      console.log(`[Tokens] Token already used: ${tokenId}`)
      return null
    }

    // Check if token is expired (15 minutes)
    const now = Date.now()
    if (now - tokenData.created_at > 15 * 60 * 1000) {
      console.log(`[Tokens] Token expired: ${tokenId}`)
      return null
    }

    // Mark token as used
    tokenData.used = true

    if (kv) {
      await kv.put(tokenId, JSON.stringify(tokenData), {
        expirationTtl: 60, // Keep for 1 more minute for audit
      })
    } else {
      if (typeof globalThis !== 'undefined' && (globalThis as any).tokenStore) {
        (globalThis as any).tokenStore.set(tokenId, tokenData)
      }
    }

    // Decrypt card data
    const decrypted = await decryptAES(tokenData.encrypted_card, encryptionKey)
    const cardData: CardData = JSON.parse(decrypted)

    console.log(`[Tokens] Token consumed successfully: ${tokenId}`)

    return cardData
  } catch (error) {
    console.error(`[Tokens] Error consuming token ${tokenId}:`, error)
    return null
  }
}
