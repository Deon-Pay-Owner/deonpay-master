/**
 * Events Emission System
 *
 * Manages event creation and queuing for webhook delivery.
 *
 * FLOW:
 * 1. Event occurs in router (payment succeeded, charge captured, etc.)
 * 2. emitEvent() is called with event type and data
 * 3. Fetches merchant's active webhooks subscribed to that event type
 * 4. Creates webhook_deliveries records in database
 * 5. Background worker/cron picks up pending deliveries and dispatches them
 *
 * USAGE:
 * ```typescript
 * import { emitEvent } from './events'
 *
 * await emitEvent({
 *   supabase,
 *   merchantId: 'merchant_xxx',
 *   eventType: 'payment_intent.succeeded',
 *   data: paymentIntent,
 * })
 * ```
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentIntent, Charge, Refund } from '../schemas/canonical'

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * All possible event types that can be emitted
 * These must match the events that merchants can subscribe to in webhooks
 */
export type EventType =
  // Payment Intent events
  | 'payment_intent.created'
  | 'payment_intent.processing'
  | 'payment_intent.requires_action'
  | 'payment_intent.succeeded'
  | 'payment_intent.failed'
  | 'payment_intent.canceled'
  // Charge events
  | 'charge.authorized'
  | 'charge.captured'
  | 'charge.failed'
  | 'charge.voided'
  // Refund events
  | 'refund.created'
  | 'refund.succeeded'
  | 'refund.failed'

/**
 * Event payload structure
 */
export type EventPayload = {
  id: string // Event ID (UUID)
  type: EventType
  created: number // Unix timestamp
  data: {
    object: PaymentIntent | Charge | Refund | any
  }
}

/**
 * Parameters for emitting an event
 */
export type EmitEventParams = {
  supabase: SupabaseClient
  merchantId: string
  eventType: EventType
  data: any // The object that triggered the event (PaymentIntent, Charge, etc.)
}

// ============================================================================
// EMIT EVENT
// ============================================================================

/**
 * Emit an event and queue webhook deliveries
 *
 * STEPS:
 * 1. Generate event ID and payload
 * 2. Fetch merchant's active webhooks subscribed to this event type
 * 3. Create webhook_deliveries records for each webhook
 * 4. Return event details
 *
 * @param params - Event parameters
 * @returns Event payload
 */
export async function emitEvent(params: EmitEventParams): Promise<EventPayload> {
  const { supabase, merchantId, eventType, data } = params

  console.log(`[Events] Emitting event: ${eventType}`, {
    merchantId,
    dataId: data.id,
  })

  // STEP 1: Generate event payload
  const eventId = crypto.randomUUID()
  const eventPayload: EventPayload = {
    id: eventId,
    type: eventType,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: data,
    },
  }

  // STEP 2: Fetch merchant's webhooks subscribed to this event type
  const { data: webhooks, error: webhooksError } = await supabase
    .from('webhooks')
    .select('id, url, secret, events')
    .eq('merchant_id', merchantId)
    .eq('is_active', true)

  if (webhooksError) {
    console.error('[Events] Error fetching webhooks:', webhooksError)
    // Don't throw - event emission failure shouldn't break the main flow
    return eventPayload
  }

  if (!webhooks || webhooks.length === 0) {
    console.log('[Events] No active webhooks found for merchant', { merchantId })
    return eventPayload
  }

  // STEP 3: Filter webhooks subscribed to this event type
  const subscribedWebhooks = webhooks.filter(
    (webhook) =>
      webhook.events.includes(eventType) || webhook.events.includes('*') // Support wildcard
  )

  if (subscribedWebhooks.length === 0) {
    console.log(`[Events] No webhooks subscribed to ${eventType}`, {
      merchantId,
    })
    return eventPayload
  }

  console.log(
    `[Events] Queuing deliveries for ${subscribedWebhooks.length} webhook(s)`,
    { eventType, merchantId }
  )

  // STEP 4: Create webhook_deliveries records
  const deliveries = subscribedWebhooks.map((webhook) => ({
    merchant_id: merchantId,
    webhook_id: webhook.id,
    event_type: eventType,
    event_id: eventId,
    endpoint_url: webhook.url,
    payload: eventPayload,
    attempt: 1,
    max_attempts: 3, // Will retry up to 3 times
    delivered: false,
  }))

  const { error: deliveriesError } = await supabase
    .from('webhook_deliveries')
    .insert(deliveries)

  if (deliveriesError) {
    console.error('[Events] Error creating webhook deliveries:', deliveriesError)
    // Don't throw - just log the error
  } else {
    console.log(`[Events] Created ${deliveries.length} webhook delivery records`)
  }

  return eventPayload
}

// ============================================================================
// EVENT HELPERS
// ============================================================================

/**
 * Emit payment_intent.succeeded event
 */
export async function emitPaymentIntentSucceeded(
  supabase: SupabaseClient,
  merchantId: string,
  paymentIntent: PaymentIntent
): Promise<void> {
  await emitEvent({
    supabase,
    merchantId,
    eventType: 'payment_intent.succeeded',
    data: paymentIntent,
  })
}

/**
 * Emit payment_intent.failed event
 */
export async function emitPaymentIntentFailed(
  supabase: SupabaseClient,
  merchantId: string,
  paymentIntent: PaymentIntent
): Promise<void> {
  await emitEvent({
    supabase,
    merchantId,
    eventType: 'payment_intent.failed',
    data: paymentIntent,
  })
}

/**
 * Emit payment_intent.requires_action event (3DS)
 */
export async function emitPaymentIntentRequiresAction(
  supabase: SupabaseClient,
  merchantId: string,
  paymentIntent: PaymentIntent
): Promise<void> {
  await emitEvent({
    supabase,
    merchantId,
    eventType: 'payment_intent.requires_action',
    data: paymentIntent,
  })
}

/**
 * Emit charge.captured event
 */
export async function emitChargeCaptured(
  supabase: SupabaseClient,
  merchantId: string,
  charge: Charge
): Promise<void> {
  await emitEvent({
    supabase,
    merchantId,
    eventType: 'charge.captured',
    data: charge,
  })
}

/**
 * Emit charge.voided event
 */
export async function emitChargeVoided(
  supabase: SupabaseClient,
  merchantId: string,
  charge: Charge
): Promise<void> {
  await emitEvent({
    supabase,
    merchantId,
    eventType: 'charge.voided',
    data: charge,
  })
}

/**
 * Emit refund.succeeded event
 */
export async function emitRefundSucceeded(
  supabase: SupabaseClient,
  merchantId: string,
  refund: Refund
): Promise<void> {
  await emitEvent({
    supabase,
    merchantId,
    eventType: 'refund.succeeded',
    data: refund,
  })
}
