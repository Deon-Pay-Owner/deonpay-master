/**
 * BFF Endpoint: Create Payment Intent for Payment Link
 *
 * Validates payment link, creates/finds customer, and creates payment intent
 *
 * POST /api/checkout/create-payment-intent
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const API_BASE_URL = process.env.NEXT_PUBLIC_DEONPAY_API_URL || 'https://api.deonpay.mx'

interface CreatePaymentIntentRequest {
  urlKey: string
  email?: string
  name?: string
  phone?: string
  amount?: number // In cents, required if mode is customer_chooses
}

export async function POST(req: NextRequest) {
  try {
    const body: CreatePaymentIntentRequest = await req.json()
    const { urlKey, email, name, phone, amount } = body

    if (!urlKey) {
      return NextResponse.json(
        { error: { message: 'urlKey is required', code: 'missing_url_key' } },
        { status: 400 }
      )
    }

    // Create Supabase client with service role (bypass RLS for validation)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // STEP 1: Fetch payment link by url_key
    const { data: paymentLink, error: linkError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('url_key', urlKey)
      .single()

    if (linkError || !paymentLink) {
      return NextResponse.json(
        { error: { message: 'Payment link not found', code: 'link_not_found' } },
        { status: 404 }
      )
    }

    // STEP 2: Validate payment link is active
    if (!paymentLink.active) {
      return NextResponse.json(
        { error: { message: 'Payment link is inactive', code: 'link_inactive' } },
        { status: 400 }
      )
    }

    // STEP 3: Check if expired
    const expiresAt = paymentLink.metadata?.expires_at
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return NextResponse.json(
        { error: { message: 'Payment link has expired', code: 'link_expired' } },
        { status: 400 }
      )
    }

    // STEP 4: Check max uses
    const restrictions = paymentLink.restrictions?.completed_sessions
    if (restrictions?.enabled && restrictions?.limit) {
      if ((paymentLink.completed_sessions_count || 0) >= restrictions.limit) {
        return NextResponse.json(
          { error: { message: 'Payment link has reached maximum uses', code: 'link_max_uses' } },
          { status: 400 }
        )
      }
    }

    // STEP 5: Determine amount
    const metadata = paymentLink.metadata || {}
    const mode = metadata.mode || 'fixed_amount'
    let finalAmount: number

    if (mode === 'customer_chooses') {
      // Customer must provide amount
      if (!amount || amount <= 0) {
        return NextResponse.json(
          { error: { message: 'Amount is required for customer-chooses mode', code: 'missing_amount' } },
          { status: 400 }
        )
      }
      finalAmount = amount
    } else {
      // Fixed amount mode
      if (paymentLink.line_items && Array.isArray(paymentLink.line_items) && paymentLink.line_items.length > 0) {
        // Has products - sum price_data from line items
        finalAmount = paymentLink.line_items.reduce((sum: number, item: any) => {
          const unitAmount = item.price_data?.unit_amount || 0
          const quantity = item.quantity || 1
          return sum + (unitAmount * quantity)
        }, 0)
      } else if (metadata.amount) {
        // Amount-only link
        finalAmount = metadata.amount
      } else {
        return NextResponse.json(
          { error: { message: 'Cannot determine payment amount', code: 'invalid_amount' } },
          { status: 400 }
        )
      }
    }

    // STEP 6: Get merchant's public API key to call API Worker
    const { data: apiKeys, error: keyError } = await supabase
      .from('api_keys')
      .select('public_key, key_type, is_active, created_at')
      .eq('merchant_id', paymentLink.merchant_id)
      .eq('key_type', 'public')
      .eq('is_active', true)
      .not('public_key', 'is', null)
      .order('created_at', { ascending: false })

    if (keyError || !apiKeys || apiKeys.length === 0) {
      return NextResponse.json(
        { error: { message: 'Merchant public API key not found', code: 'api_key_not_found' } },
        { status: 500 }
      )
    }

    // Prefer live keys over test keys
    const liveKey = apiKeys.find(k => k.public_key.startsWith('pk_live_'))
    const testKey = apiKeys.find(k => k.public_key.startsWith('pk_test_'))
    const selectedKey = liveKey || testKey || apiKeys[0]
    const publicKey = selectedKey.public_key

    // STEP 7: Create or find customer (if email provided)
    let customerId: string | undefined

    if (email) {
      // Try to find existing customer first
      const customerSearchResponse = await fetch(
        `${API_BASE_URL}/api/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${publicKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (customerSearchResponse.ok) {
        const customerSearchData = await customerSearchResponse.json()
        if (customerSearchData.data && customerSearchData.data.length > 0) {
          customerId = customerSearchData.data[0].id
        }
      }

      // If no customer found, create one
      if (!customerId) {
        const customerCreateResponse = await fetch(`${API_BASE_URL}/api/v1/customers`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            name,
            phone,
            metadata: {
              source: 'payment_link',
              payment_link_id: paymentLink.id,
              payment_link_url_key: urlKey
            }
          })
        })

        if (customerCreateResponse.ok) {
          const customerData = await customerCreateResponse.json()
          customerId = customerData.id
        }
      }
    }

    // STEP 8: Create payment intent via API Worker
    const paymentIntentPayload: any = {
      amount: finalAmount,
      currency: paymentLink.currency || 'MXN',
      metadata: {
        payment_link_id: paymentLink.id,
        payment_link_url_key: urlKey,
        source: 'payment_link',
        internal_name: metadata.internal_name || '',
        // Include customer info if provided
        ...(email && { customer_email: email }),
        ...(name && { customer_name: name }),
        ...(phone && { customer_phone: phone })
      }
    }

    if (customerId) {
      paymentIntentPayload.customer_id = customerId
    }

    const paymentIntentResponse = await fetch(`${API_BASE_URL}/api/v1/payment_intents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentIntentPayload)
    })

    if (!paymentIntentResponse.ok) {
      const errorData = await paymentIntentResponse.json()
      return NextResponse.json(
        { error: errorData.error || { message: 'Failed to create payment intent', code: 'payment_intent_error' } },
        { status: paymentIntentResponse.status }
      )
    }

    const paymentIntent = await paymentIntentResponse.json()

    // STEP 9: Return client_secret and payment details to frontend
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: finalAmount,
      currency: paymentLink.currency || 'MXN',
      publicKey: publicKey // Return public key for DeonPay Elements
    })

  } catch (error: any) {
    console.error('[BFF] Create payment intent error:', error)
    return NextResponse.json(
      { error: { message: error.message || 'Internal server error', code: 'internal_error' } },
      { status: 500 }
    )
  }
}
