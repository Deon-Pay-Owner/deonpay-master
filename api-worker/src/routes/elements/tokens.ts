/**
 * Elements Tokens Routes
 * Handles card tokenization for Elements SDK
 */

import { Hono } from 'hono'
import { encryptAES } from '../../lib/encryption/aes'
import { detectCardBrand } from '../../utils/card'

const app = new Hono()

// ============================================================================
// POST /api/v1/elements/tokens - Create card token
// ============================================================================
app.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const { card, billing_details } = body

    // Validate card data
    if (!card || !card.number || !card.exp_month || !card.exp_year || !card.cvv) {
      return c.json(
        {
          error: {
            type: 'validation_error',
            message: 'Invalid card data',
            details: ['Card number, expiry, and CVV are required'],
          },
        },
        400
      )
    }

    // Validate card number format
    const cardNumber = card.number.replace(/\s/g, '')
    if (!/^\d{13,19}$/.test(cardNumber)) {
      return c.json(
        {
          error: {
            type: 'validation_error',
            message: 'Invalid card number',
          },
        },
        400
      )
    }

    // Detect card brand
    const brand = detectCardBrand(card)

    // Generate secure token ID
    const tokenId = `tok_${crypto.randomUUID().replace(/-/g, '')}`

    // Prepare card data for encryption
    const cardData = {
      number: cardNumber,
      exp_month: card.exp_month,
      exp_year: card.exp_year,
      cvv: card.cvv,
      brand,
    }

    // Encrypt card data (use environment variable for encryption key)
    const encryptionKey = c.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production'
    const encryptedCard = await encryptAES(JSON.stringify(cardData), encryptionKey)

    // Store token in KV with 15-minute TTL
    const tokenData = {
      encrypted_card: encryptedCard,
      billing_details,
      created_at: Date.now(),
      used: false,
    }

    // Store in Cloudflare KV (or fall back to in-memory for dev)
    if (c.env.TOKENS_KV) {
      await c.env.TOKENS_KV.put(tokenId, JSON.stringify(tokenData), {
        expirationTtl: 900, // 15 minutes
      })
    } else {
      // Fallback to global storage for development
      if (typeof globalThis !== 'undefined') {
        if (!(globalThis as any).tokenStore) {
          (globalThis as any).tokenStore = new Map()
        }
        (globalThis as any).tokenStore.set(tokenId, tokenData)
      }
    }

    console.log(`[Tokens] Created token ${tokenId} for brand ${brand}`)

    // Return token response (never include actual card data)
    const token = {
      id: tokenId,
      card: {
        brand,
        last4: cardNumber.slice(-4),
        exp_month: card.exp_month,
        exp_year: card.exp_year,
      },
    }

    return c.json({ token }, 201)
  } catch (error: any) {
    console.error('[Tokens] Error creating token:', error)
    return c.json(
      {
        error: {
          type: 'api_error',
          message: error.message || 'Failed to create token',
        },
      },
      500
    )
  }
})

export { app as elementsTokensRouter }
