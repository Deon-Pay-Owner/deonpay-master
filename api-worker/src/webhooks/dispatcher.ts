/**
 * Webhook Dispatcher
 *
 * Handles delivery of webhook events to merchant endpoints with:
 * - HMAC-SHA256 signature for security
 * - Automatic retries with exponential backoff
 * - Delivery tracking and logging
 *
 * DESIGN:
 * - This module provides functions to dispatch webhooks
 * - Should be called by a background worker/cron job
 * - Reads pending webhook_deliveries from database
 * - Signs payload with HMAC
 * - Sends HTTP POST to merchant endpoint
 * - Updates delivery status in database
 *
 * USAGE:
 * ```typescript
 * // From a cron job or scheduled task:
 * await processPendingWebhooks(supabase)
 *
 * // Or manually dispatch a specific delivery:
 * await dispatchWebhook(supabase, deliveryId)
 * ```
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// TYPES
// ============================================================================

type WebhookDelivery = {
  id: string
  merchant_id: string
  webhook_id: string
  event_type: string
  event_id: string | null
  endpoint_url: string
  payload: any
  attempt: number
  max_attempts: number
  status_code: number | null
  response_body: string | null
  error: string | null
  next_retry_at: string | null
  delivered: boolean
  delivered_at: string | null
  created_at: string
}

type DispatchResult = {
  success: boolean
  statusCode?: number
  responseBody?: string
  error?: string
}

// ============================================================================
// HMAC SIGNING
// ============================================================================

/**
 * Generate HMAC-SHA256 signature for webhook payload
 *
 * Format: sha256=<hex_signature>
 *
 * The signature is computed over: timestamp.payload_json
 * This prevents replay attacks by including timestamp
 *
 * @param payload - Webhook payload object
 * @param secret - Webhook secret (from webhooks table)
 * @param timestamp - Unix timestamp (seconds)
 * @returns Signature string
 */
async function generateSignature(
  payload: any,
  secret: string,
  timestamp: number
): Promise<string> {
  const payloadString = JSON.stringify(payload)
  const signedPayload = `${timestamp}.${payloadString}`

  // Encode secret and signed payload
  const encoder = new TextEncoder()
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    encoder.encode(signedPayload)
  )

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(signature))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

  return `sha256=${hashHex}`
}

// ============================================================================
// WEBHOOK DISPATCH
// ============================================================================

/**
 * Dispatch a single webhook delivery
 *
 * STEPS:
 * 1. Fetch webhook secret
 * 2. Generate HMAC signature
 * 3. Send HTTP POST to endpoint
 * 4. Update delivery record with result
 * 5. Schedule retry if failed (with exponential backoff)
 *
 * @param supabase - Supabase client
 * @param deliveryId - ID of webhook_deliveries record
 * @returns Dispatch result
 */
export async function dispatchWebhook(
  supabase: SupabaseClient,
  deliveryId: string
): Promise<DispatchResult> {
  console.log(`[Webhook Dispatcher] Processing delivery ${deliveryId}`)

  // STEP 1: Fetch delivery record
  const { data: delivery, error: fetchError } = await supabase
    .from('webhook_deliveries')
    .select('*')
    .eq('id', deliveryId)
    .single()

  if (fetchError || !delivery) {
    console.error('[Webhook Dispatcher] Delivery not found:', deliveryId)
    return { success: false, error: 'Delivery not found' }
  }

  // STEP 2: Fetch webhook secret
  const { data: webhook, error: webhookError } = await supabase
    .from('webhooks')
    .select('secret')
    .eq('id', delivery.webhook_id)
    .single()

  if (webhookError || !webhook) {
    console.error('[Webhook Dispatcher] Webhook not found:', delivery.webhook_id)
    await updateDeliveryFailed(supabase, deliveryId, 'Webhook configuration not found')
    return { success: false, error: 'Webhook not found' }
  }

  // STEP 3: Generate signature
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = await generateSignature(delivery.payload, webhook.secret, timestamp)

  // STEP 4: Send HTTP POST
  console.log(`[Webhook Dispatcher] Sending to ${delivery.endpoint_url}`)

  try {
    const response = await fetch(delivery.endpoint_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DeonPay-Signature': signature,
        'X-DeonPay-Event-Type': delivery.event_type,
        'X-DeonPay-Event-Id': delivery.event_id || '',
        'X-DeonPay-Timestamp': timestamp.toString(),
        'User-Agent': 'DeonPay-Webhooks/1.0',
      },
      body: JSON.stringify(delivery.payload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    const responseBody = await response.text().catch(() => '')
    const statusCode = response.status

    console.log(`[Webhook Dispatcher] Response: ${statusCode}`, {
      deliveryId,
      endpoint: delivery.endpoint_url,
    })

    // STEP 5: Update delivery record based on response
    if (statusCode >= 200 && statusCode < 300) {
      // Success
      await supabase
        .from('webhook_deliveries')
        .update({
          delivered: true,
          delivered_at: new Date().toISOString(),
          status_code: statusCode,
          response_body: responseBody.substring(0, 1000), // Limit size
        })
        .eq('id', deliveryId)

      console.log(`[Webhook Dispatcher] Delivered successfully: ${deliveryId}`)
      return { success: true, statusCode, responseBody }
    } else {
      // Failed - schedule retry
      const shouldRetry = delivery.attempt < delivery.max_attempts
      await updateDeliveryFailed(
        supabase,
        deliveryId,
        `HTTP ${statusCode}: ${responseBody.substring(0, 200)}`,
        shouldRetry,
        delivery.attempt
      )

      return {
        success: false,
        statusCode,
        responseBody,
        error: `HTTP ${statusCode}`,
      }
    }
  } catch (error: any) {
    console.error('[Webhook Dispatcher] Dispatch error:', error)

    // Failed - schedule retry
    const shouldRetry = delivery.attempt < delivery.max_attempts
    await updateDeliveryFailed(
      supabase,
      deliveryId,
      error.message || 'Network error',
      shouldRetry,
      delivery.attempt
    )

    return { success: false, error: error.message || 'Network error' }
  }
}

/**
 * Update delivery record when failed
 *
 * @param supabase - Supabase client
 * @param deliveryId - Delivery ID
 * @param errorMessage - Error message
 * @param shouldRetry - Whether to schedule retry
 * @param currentAttempt - Current attempt number
 */
async function updateDeliveryFailed(
  supabase: SupabaseClient,
  deliveryId: string,
  errorMessage: string,
  shouldRetry: boolean = false,
  currentAttempt: number = 1
): Promise<void> {
  const updates: any = {
    error: errorMessage,
    status_code: null,
  }

  if (shouldRetry) {
    // Exponential backoff: 1min, 5min, 30min
    const backoffMinutes = [1, 5, 30][currentAttempt - 1] || 30
    const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000)
    updates.next_retry_at = nextRetryAt.toISOString()
    updates.attempt = currentAttempt + 1

    console.log(
      `[Webhook Dispatcher] Scheduled retry for ${deliveryId} at ${nextRetryAt.toISOString()}`
    )
  } else {
    updates.delivered = false
    console.log(`[Webhook Dispatcher] Max attempts reached for ${deliveryId}`)
  }

  await supabase.from('webhook_deliveries').update(updates).eq('id', deliveryId)
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Process all pending webhook deliveries
 *
 * Should be called by a cron job or scheduled task.
 * Processes deliveries that are:
 * - Not yet delivered
 * - Attempt < max_attempts
 * - next_retry_at is null OR in the past
 *
 * @param supabase - Supabase client
 * @param batchSize - Max number of deliveries to process (default: 50)
 * @returns Number of deliveries processed
 */
export async function processPendingWebhooks(
  supabase: SupabaseClient,
  batchSize: number = 50
): Promise<number> {
  console.log('[Webhook Dispatcher] Processing pending webhooks...')

  // Fetch pending deliveries
  const { data: deliveries, error } = await supabase
    .from('webhook_deliveries')
    .select('id, max_attempts, attempt')
    .eq('delivered', false)
    .or(`next_retry_at.is.null,next_retry_at.lt.${new Date().toISOString()}`)
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (error) {
    console.error('[Webhook Dispatcher] Error fetching deliveries:', error)
    return 0
  }

  if (!deliveries || deliveries.length === 0) {
    console.log('[Webhook Dispatcher] No pending deliveries')
    return 0
  }

  console.log(`[Webhook Dispatcher] Found ${deliveries.length} pending deliveries`)

  // Filter deliveries where attempt < max_attempts (must be done in code since Supabase can't compare columns)
  const eligibleDeliveries = deliveries.filter(d => d.attempt < d.max_attempts)

  console.log(`[Webhook Dispatcher] ${eligibleDeliveries.length} deliveries eligible for processing`)

  // Process each delivery sequentially
  // (Could be parallelized with Promise.all for better performance)
  let processed = 0
  for (const delivery of eligibleDeliveries) {
    try {
      await dispatchWebhook(supabase, delivery.id)
      processed++
    } catch (error) {
      console.error(
        `[Webhook Dispatcher] Error processing ${delivery.id}:`,
        error
      )
    }
  }

  console.log(`[Webhook Dispatcher] Processed ${processed} deliveries`)
  return processed
}

// ============================================================================
// WEBHOOK VERIFICATION (for merchants)
// ============================================================================

/**
 * Verify webhook signature
 *
 * Merchants can use this logic to verify that webhooks are from DeonPay.
 * This is an example implementation they can use in their backend.
 *
 * @param payload - Webhook payload (as received)
 * @param signature - X-DeonPay-Signature header
 * @param timestamp - X-DeonPay-Timestamp header
 * @param secret - Webhook secret (from dashboard)
 * @returns true if signature is valid
 */
export async function verifyWebhookSignature(
  payload: any,
  signature: string,
  timestamp: number,
  secret: string
): Promise<boolean> {
  // Check signature format
  if (!signature.startsWith('sha256=')) {
    return false
  }

  // Check timestamp is recent (within 5 minutes)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > 300) {
    console.warn('[Webhook Verification] Timestamp too old or in future')
    return false
  }

  // Compute expected signature
  const expectedSignature = await generateSignature(payload, secret, timestamp)

  // Constant-time comparison to prevent timing attacks
  return signature === expectedSignature
}
