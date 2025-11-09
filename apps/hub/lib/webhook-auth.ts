import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase'
import { verifySecretKey } from './api-keys'

export interface AuthResult {
  authorized: boolean
  merchantId?: string
  error?: string
  status?: number
}

/**
 * Authenticate request using Bearer token (secret key)
 * Expected header: Authorization: Bearer sk_test_xxxxx or sk_live_xxxxx
 */
export async function authenticateWithSecretKey(
  request: NextRequest
): Promise<AuthResult> {
  // Get Authorization header
  const authHeader = request.headers.get('Authorization')

  if (!authHeader) {
    return {
      authorized: false,
      error: 'Missing Authorization header',
      status: 401,
    }
  }

  // Check Bearer format
  if (!authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      error: 'Invalid Authorization header format. Expected: Bearer sk_xxx',
      status: 401,
    }
  }

  const secretKey = authHeader.substring(7).trim()

  // Validate secret key format
  if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
    return {
      authorized: false,
      error: 'Invalid secret key format',
      status: 401,
    }
  }

  try {
    const supabase = await createClient()

    // Find the API key in database
    const { data: apiKeys, error: queryError } = await supabase
      .from('api_keys')
      .select('id, merchant_id, secret_key_hash, is_active, key_type')
      .eq('is_active', true)

    if (queryError) {
      console.error('Error querying api_keys:', queryError)
      return {
        authorized: false,
        error: 'Internal server error',
        status: 500,
      }
    }

    if (!apiKeys || apiKeys.length === 0) {
      return {
        authorized: false,
        error: 'Invalid API key',
        status: 401,
      }
    }

    // Verify secret key against hashes
    let matchedKey = null
    for (const key of apiKeys) {
      if (verifySecretKey(secretKey, key.secret_key_hash)) {
        matchedKey = key
        break
      }
    }

    if (!matchedKey) {
      return {
        authorized: false,
        error: 'Invalid API key',
        status: 401,
      }
    }

    // Update last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', matchedKey.id)

    return {
      authorized: true,
      merchantId: matchedKey.merchant_id,
    }
  } catch (error) {
    console.error('Error in authenticateWithSecretKey:', error)
    return {
      authorized: false,
      error: 'Internal server error',
      status: 500,
    }
  }
}

/**
 * Authenticate request - tries session first, then secret key
 * This allows both dashboard (session) and API (secret key) access
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthResult> {
  const supabase = await createClient()

  // Try session-based auth first (for dashboard)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    // For session auth, we need merchantId from query or body
    const { searchParams } = new URL(request.url)
    const merchantId = searchParams.get('merchantId')

    if (!merchantId) {
      return {
        authorized: false,
        error: 'merchantId is required',
        status: 400,
      }
    }

    // Verify merchant belongs to user
    const { data: merchant } = await supabase
      .from('merchants')
      .select('owner_user_id')
      .eq('id', merchantId)
      .single()

    if (!merchant || merchant.owner_user_id !== user.id) {
      return {
        authorized: false,
        error: 'Unauthorized',
        status: 403,
      }
    }

    return {
      authorized: true,
      merchantId,
    }
  }

  // If no session, try secret key auth
  return await authenticateWithSecretKey(request)
}
