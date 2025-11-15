/**
 * Router Orchestrator
 *
 * Main entry point for processing payments through multi-acquirer system.
 * Coordinates routing, adapters, mappers, and database operations.
 *
 * MAIN FUNCTIONS:
 * - confirmPaymentIntent() - Authorize and optionally capture payment
 * - captureCharge() - Capture a pre-authorized payment
 * - refundCharge() - Refund a captured payment
 * - voidCharge() - Cancel a pre-authorized payment
 *
 * FLOW:
 * 1. Validate input (PaymentIntent/Charge state)
 * 2. Pick route (routing strategy)
 * 3. Map to canonical format (mapper)
 * 4. Call adapter (mock/adyen/stripe/etc)
 * 5. Map result back to DeonPay format
 * 6. Update database (PaymentIntent, Charge, etc)
 * 7. Emit events (webhooks)
 *
 * USAGE:
 * ```typescript
 * import { confirmPaymentIntent } from './router'
 *
 * const result = await confirmPaymentIntent({
 *   supabase,
 *   paymentIntentId: 'pi_xxx',
 *   merchantId: 'merchant_xxx',
 *   requestId: 'req_xxx',
 *   env,
 * })
 * ```
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentIntent, Charge } from '../schemas/canonical'
import { getAdapter } from './adapters'
import { pickRoute, type MerchantRoutingConfig } from './routing-strategy'
import {
  mapPIToAuthorizeInput,
  mapAuthorizeOutputToCharge,
  mapChargeToCaptureInput,
  mapChargeToRefundInput,
  mapChargeToVoidInput,
  validatePaymentIntentForAuthorization,
  validateChargeForCapture,
  validateChargeForRefund,
  validateChargeForVoid,
} from './mapper'
import { emitEvent } from './events'

// ============================================================================
// TYPES
// ============================================================================

export type RawPaymentMethod = {
  type: 'card'
  number: string
  exp_month: number
  exp_year: number
  cvv: string
}

export type BillingDetails = {
  name?: string
  email?: string
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }
}

export type CompleteAuthenticationParams = {
  supabase: SupabaseClient
  paymentIntentId: string
  merchantId: string
  requestId: string
  authenticationResult: string // PaRes from 3DS
  merchantData?: string // MD from 3DS
  env: {
    DEFAULT_ADAPTER?: string
    SUPABASE_URL?: string
    SUPABASE_SERVICE_ROLE_KEY?: string
  }
}

export type CompleteAuthenticationResult = {
  paymentIntent: PaymentIntent
  charge?: Charge
}

export type ConfirmPaymentIntentParams = {
  supabase: SupabaseClient
  paymentIntentId: string
  merchantId: string
  requestId: string
  rawPaymentMethod?: RawPaymentMethod
  billingDetails?: BillingDetails
  env: {
    DEFAULT_ADAPTER?: string
    SUPABASE_URL?: string
    SUPABASE_SERVICE_ROLE_KEY?: string
  }
}

export type ConfirmPaymentIntentResult = {
  paymentIntent: PaymentIntent
  charge?: Charge
  requiresAction?: boolean
  redirectUrl?: string
}

export type CaptureChargeParams = {
  supabase: SupabaseClient
  chargeId: string
  merchantId: string
  requestId: string
  amountToCapture?: number
  env: {
    DEFAULT_ADAPTER?: string
    SUPABASE_URL?: string
    SUPABASE_SERVICE_ROLE_KEY?: string
  }
}

export type CaptureChargeResult = {
  charge: Charge
  paymentIntent: PaymentIntent
}

export type RefundChargeParams = {
  supabase: SupabaseClient
  chargeId: string
  merchantId: string
  requestId: string
  amount: number
  reason?: string
  env: {
    DEFAULT_ADAPTER?: string
    SUPABASE_URL?: string
    SUPABASE_SERVICE_ROLE_KEY?: string
  }
}

export type RefundChargeResult = {
  refund: {
    id: string
    amount: number
    status: string
    acquirer_reference?: string
  }
  charge: Charge
}

export type VoidChargeParams = {
  supabase: SupabaseClient
  chargeId: string
  merchantId: string
  requestId: string
  env: {
    DEFAULT_ADAPTER?: string
    SUPABASE_URL?: string
    SUPABASE_SERVICE_ROLE_KEY?: string
  }
}

export type VoidChargeResult = {
  charge: Charge
  paymentIntent: PaymentIntent
}

// ============================================================================
// CONFIRM PAYMENT INTENT (Authorize + Optional Capture)
// ============================================================================

/**
 * Confirm a payment intent - authorize and optionally capture payment
 *
 * FLOW:
 * 1. Fetch PaymentIntent from DB
 * 2. Validate it can be confirmed
 * 3. Pick routing strategy
 * 4. Map to canonical format
 * 5. Call adapter.authorize()
 * 6. Handle result:
 *    - requires_action: Return redirect URL for 3DS
 *    - failed: Update PI to failed, return error
 *    - authorized: Create charge, update PI, optionally capture
 * 7. Emit events
 *
 * @param params - Confirmation parameters
 * @returns Confirmation result
 * @throws Error if validation fails or adapter errors
 */
export async function confirmPaymentIntent(
  params: ConfirmPaymentIntentParams
): Promise<ConfirmPaymentIntentResult> {
  const { supabase, paymentIntentId, merchantId, requestId, rawPaymentMethod, billingDetails, env } = params

  console.log(`[Router] Confirming payment intent ${paymentIntentId}`, {
    requestId,
    merchantId,
    hasRawPaymentMethod: !!rawPaymentMethod,
    hasBillingDetails: !!billingDetails,
  })

  // STEP 1: Fetch PaymentIntent from database
  const { data: paymentIntent, error: fetchError } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', paymentIntentId)
    .eq('merchant_id', merchantId)
    .single()

  if (fetchError || !paymentIntent) {
    throw new Error(`Payment intent not found: ${paymentIntentId}`)
  }

  // STEP 2: Validate payment intent can be confirmed
  validatePaymentIntentForAuthorization(paymentIntent)

  // STEP 3: Fetch merchant routing config (if exists)
  const { data: merchant } = await supabase
    .from('merchants')
    .select('routing_config')
    .eq('id', merchantId)
    .single()

  const merchantConfig: MerchantRoutingConfig | null =
    merchant?.routing_config || null

  // STEP 4: Pick route using routing strategy
  const route = await pickRoute(paymentIntent, merchantConfig, env)

  console.log(`[Router] Selected route: ${route.adapter}`, {
    requestId,
    merchantRef: route.merchantRef,
  })

  // STEP 5: Get adapter instance
  const adapter = getAdapter(route.adapter)

  // STEP 6: Map PaymentIntent to canonical authorize input
  const authorizeInput = mapPIToAuthorizeInput(
    paymentIntent,
    requestId,
    route,
    rawPaymentMethod,
    billingDetails
  )

  // STEP 7: Call adapter to authorize payment
  console.log(`[Router] Calling adapter.authorize()`, { requestId })
  const authorizeOutput = await adapter.authorize(authorizeInput)

  console.log(`[Router] Authorization outcome: ${authorizeOutput.outcome}`, {
    requestId,
  })

  // STEP 8: Handle authorization outcome
  switch (authorizeOutput.outcome) {
    case 'requires_action': {
      // 3DS or other action required
      console.log(
        `[Router] Payment requires action (3DS), updating PI status`,
        { requestId }
      )

      // Store 3DS data in metadata for later use
      const threeDSMetadata = authorizeOutput.threeDS?.data || {}

      // Update PaymentIntent status to requires_action
      const { data: updatedPI } = await supabase
        .from('payment_intents')
        .update({
          status: 'requires_action',
          acquirer_routing: {
            selected_route: {
              adapter: route.adapter,
              merchant_ref: route.merchantRef,
              config: route.config,
            },
          },
          metadata: {
            ...paymentIntent.metadata,
            threeDS: threeDSMetadata,
          },
        })
        .eq('id', paymentIntentId)
        .select()
        .single()

      // Emit event
      await emitEvent({
        supabase,
        merchantId,
        eventType: 'payment_intent.requires_action',
        data: updatedPI,
        env,
      }).catch((err) =>
        console.error('[Router] Error emitting event:', err)
      )

      return {
        paymentIntent: updatedPI,
        requiresAction: true,
        redirectUrl: authorizeOutput.threeDS?.redirectUrl,
      }
    }

    case 'failed': {
      // Authorization failed
      console.log(`[Router] Authorization failed`, {
        requestId,
        code: authorizeOutput.processorResponse?.code,
        message: authorizeOutput.processorResponse?.message,
      })

      // Update PaymentIntent status to failed
      const { data: failedPI } = await supabase
        .from('payment_intents')
        .update({ status: 'failed' })
        .eq('id', paymentIntentId)
        .select()
        .single()

      // Create charge record with failed status
      const failedCharge = mapAuthorizeOutputToCharge(
        authorizeOutput,
        paymentIntent,
        route
      )

      const { data: charge } = await supabase
        .from('charges')
        .insert(failedCharge)
        .select()
        .single()

      // Emit events
      await emitEvent({
        supabase,
        merchantId,
        eventType: 'payment_intent.failed',
        data: failedPI,
        env,
      }).catch((err) => console.error('[Router] Error emitting event:', err))

      await emitEvent({
        supabase,
        merchantId,
        eventType: 'charge.failed',
        data: charge,
        env,
      }).catch((err) => console.error('[Router] Error emitting event:', err))

      throw new Error(
        authorizeOutput.processorResponse?.message || 'Authorization failed'
      )
    }

    case 'authorized': {
      // Authorization successful
      console.log(`[Router] Authorization successful`, {
        requestId,
        amountAuthorized: authorizeOutput.amountAuthorized,
        authCode: authorizeOutput.authorizationCode,
      })

      // Create charge record
      const chargeData = mapAuthorizeOutputToCharge(
        authorizeOutput,
        paymentIntent,
        route
      )

      const { data: charge, error: chargeError } = await supabase
        .from('charges')
        .insert(chargeData)
        .select()
        .single()

      if (chargeError || !charge) {
        throw new Error(`Failed to create charge: ${chargeError?.message}`)
      }

      // Emit charge.authorized event
      await emitEvent({
        supabase,
        merchantId,
        eventType: 'charge.authorized',
        data: charge,
        env,
      }).catch((err) => console.error('[Router] Error emitting event:', err))

      // Update PaymentIntent status
      const newStatus =
        paymentIntent.capture_method === 'automatic' ? 'succeeded' : 'processing'

      const { data: updatedPI } = await supabase
        .from('payment_intents')
        .update({
          status: newStatus,
          acquirer_routing: {
            selected_route: {
              adapter: route.adapter,
              merchant_ref: route.merchantRef,
              config: route.config,
            },
          },
        })
        .eq('id', paymentIntentId)
        .select()
        .single()

      console.log(`[Router] Payment intent confirmed successfully`, {
        requestId,
        status: newStatus,
        chargeId: charge.id,
      })

      // Emit event for webhooks
      await emitEvent({
        supabase,
        merchantId,
        eventType: 'payment_intent.succeeded',
        data: updatedPI,
        env,
      }).catch((err) =>
        console.error('[Router] Error emitting event:', err)
      )

      return {
        paymentIntent: updatedPI,
        charge,
        requiresAction: false,
      }
    }

    default:
      throw new Error(
        `Unknown authorization outcome: ${(authorizeOutput as any).outcome}`
      )
  }
}

// ============================================================================
// CAPTURE CHARGE
// ============================================================================

/**
 * Capture a pre-authorized payment
 *
 * FLOW:
 * 1. Fetch Charge from DB
 * 2. Validate it can be captured
 * 3. Get adapter from charge.acquirer_name
 * 4. Map to canonical format
 * 5. Call adapter.capture()
 * 6. Update charge and payment intent
 * 7. Emit events
 *
 * @param params - Capture parameters
 * @returns Capture result
 * @throws Error if validation fails or adapter errors
 */
export async function captureCharge(
  params: CaptureChargeParams
): Promise<CaptureChargeResult> {
  const { supabase, chargeId, merchantId, requestId, amountToCapture, env } =
    params

  console.log(`[Router] Capturing charge ${chargeId}`, {
    requestId,
    amountToCapture,
  })

  // STEP 1: Fetch charge from database
  const { data: charge, error: fetchError } = await supabase
    .from('charges')
    .select('*')
    .eq('id', chargeId)
    .eq('merchant_id', merchantId)
    .single()

  if (fetchError || !charge) {
    throw new Error(`Charge not found: ${chargeId}`)
  }

  // STEP 2: Validate charge can be captured
  validateChargeForCapture(charge)

  // STEP 3: Get adapter
  const adapterName = charge.acquirer_name || env.DEFAULT_ADAPTER || 'mock'
  const adapter = getAdapter(adapterName)

  // STEP 4: Map to canonical capture input
  const captureInput = mapChargeToCaptureInput(
    charge,
    requestId,
    amountToCapture
  )

  // STEP 5: Call adapter to capture
  console.log(`[Router] Calling adapter.capture()`, { requestId })
  const captureOutput = await adapter.capture(captureInput)

  if (captureOutput.outcome !== 'captured') {
    throw new Error(
      captureOutput.processorResponse?.message || 'Capture failed'
    )
  }

  console.log(`[Router] Capture successful`, {
    requestId,
    amountCaptured: captureOutput.amountCaptured,
  })

  // STEP 6: Update charge in database
  const capturedAmount = captureOutput.amountCaptured || charge.amount_authorized

  const { data: updatedCharge } = await supabase
    .from('charges')
    .update({
      amount_captured: capturedAmount,
      status: 'captured',
    })
    .eq('id', chargeId)
    .select()
    .single()

  // STEP 7: Update payment intent status
  const { data: updatedPI } = await supabase
    .from('payment_intents')
    .update({ status: 'succeeded' })
    .eq('id', charge.payment_intent_id)
    .select()
    .single()

  console.log(`[Router] Charge captured successfully`, {
    requestId,
    chargeId,
    paymentIntentId: charge.payment_intent_id,
  })

  // Emit event
  await emitEvent({
    supabase,
    merchantId,
    eventType: 'charge.captured',
    data: updatedCharge,
    env,
  }).catch((err) => console.error('[Router] Error emitting event:', err))

  return {
    charge: updatedCharge,
    paymentIntent: updatedPI,
  }
}

// ============================================================================
// REFUND CHARGE
// ============================================================================

/**
 * Refund a captured payment
 *
 * FLOW:
 * 1. Fetch Charge from DB
 * 2. Validate it can be refunded
 * 3. Get adapter
 * 4. Map to canonical format
 * 5. Call adapter.refund()
 * 6. Create refund record
 * 7. Update charge amounts
 * 8. Emit events
 *
 * @param params - Refund parameters
 * @returns Refund result
 * @throws Error if validation fails or adapter errors
 */
export async function refundCharge(
  params: RefundChargeParams
): Promise<RefundChargeResult> {
  const { supabase, chargeId, merchantId, requestId, amount, reason, env } =
    params

  console.log(`[Router] Refunding charge ${chargeId}`, {
    requestId,
    amount,
    reason,
  })

  // STEP 1: Fetch charge
  const { data: charge, error: fetchError } = await supabase
    .from('charges')
    .select('*')
    .eq('id', chargeId)
    .eq('merchant_id', merchantId)
    .single()

  if (fetchError || !charge) {
    throw new Error(`Charge not found: ${chargeId}`)
  }

  // STEP 2: Validate charge can be refunded
  validateChargeForRefund(charge, amount)

  // STEP 3: Get adapter
  const adapterName = charge.acquirer_name || env.DEFAULT_ADAPTER || 'mock'
  const adapter = getAdapter(adapterName)

  // STEP 4: Map to canonical refund input
  const refundInput = mapChargeToRefundInput(charge, requestId, amount, reason)

  // STEP 5: Call adapter to refund
  console.log(`[Router] Calling adapter.refund()`, { requestId })
  const refundOutput = await adapter.refund(refundInput)

  if (refundOutput.outcome === 'failed') {
    throw new Error(
      refundOutput.processorResponse?.message || 'Refund failed'
    )
  }

  console.log(`[Router] Refund successful`, {
    requestId,
    acquirerReference: refundOutput.acquirerReference,
  })

  // STEP 6: Create refund record
  const { data: refund } = await supabase
    .from('refunds')
    .insert({
      merchant_id: merchantId,
      charge_id: chargeId,
      amount,
      currency: charge.currency,
      reason: reason || null,
      status: refundOutput.outcome === 'pending' ? 'pending' : 'succeeded',
      acquirer_reference: refundOutput.acquirerReference || null,
      metadata: {},
    })
    .select()
    .single()

  // STEP 7: Update charge amounts and status
  const newRefundedAmount = charge.amount_refunded + amount
  const isFullyRefunded = newRefundedAmount >= charge.amount_captured

  const { data: updatedCharge } = await supabase
    .from('charges')
    .update({
      amount_refunded: newRefundedAmount,
      status: isFullyRefunded ? 'refunded' : 'partially_refunded',
    })
    .eq('id', chargeId)
    .select()
    .single()

  console.log(`[Router] Charge refunded successfully`, {
    requestId,
    chargeId,
    refundId: refund.id,
  })

  // Emit event
  await emitEvent({
    supabase,
    merchantId,
    eventType: 'refund.succeeded',
    data: refund,
    env,
  }).catch((err) => console.error('[Router] Error emitting event:', err))

  return {
    refund,
    charge: updatedCharge,
  }
}

// ============================================================================
// COMPLETE 3DS AUTHENTICATION
// ============================================================================

/**
 * Complete 3DS authentication after challenge
 *
 * FLOW:
 * 1. Fetch PaymentIntent from DB
 * 2. Verify it's in requires_action status
 * 3. Get acquirer route from PI
 * 4. Get adapter
 * 5. Call adapter.authorizeWith3DS() with PaRes
 * 6. Update payment intent and create charge
 * 7. Emit events
 *
 * @param params - Authentication parameters
 * @returns Authentication result
 * @throws Error if validation fails or adapter errors
 */
export async function completeAuthentication(
  params: CompleteAuthenticationParams
): Promise<CompleteAuthenticationResult> {
  const { supabase, paymentIntentId, merchantId, requestId, authenticationResult, merchantData, env } = params

  console.log(`[Router] Completing 3DS authentication for ${paymentIntentId}`, {
    requestId,
    merchantId,
    hasPaRes: !!authenticationResult,
    hasMD: !!merchantData,
  })

  // STEP 1: Fetch PaymentIntent from database
  const { data: paymentIntent, error: fetchError } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('id', paymentIntentId)
    .eq('merchant_id', merchantId)
    .single()

  if (fetchError || !paymentIntent) {
    throw new Error(`Payment intent not found: ${paymentIntentId}`)
  }

  // STEP 2: Verify payment intent is in requires_action status
  if (paymentIntent.status !== 'requires_action') {
    throw new Error(`Payment intent is in ${paymentIntent.status} status, expected requires_action`)
  }

  // STEP 3: Get acquirer route from payment intent
  const route = paymentIntent.acquirer_routing?.selected_route
  if (!route) {
    throw new Error('No acquirer route found in payment intent')
  }

  console.log(`[Router] Using route: ${route.adapter}`, {
    requestId,
    merchantRef: route.merchant_ref,
  })

  // STEP 4: Get adapter instance
  const adapter = getAdapter(route.adapter)

  // Check if adapter supports authorizeWith3DS
  if (!adapter.authorizeWith3DS) {
    throw new Error(`Adapter ${route.adapter} does not support 3DS authentication`)
  }

  // STEP 5: Retrieve stored 3DS data (if any)
  // This could be stored in payment intent metadata or a separate table
  const threeDSData = paymentIntent.metadata?.threeDS || {}

  // STEP 6: Call adapter to complete 3DS authorization
  console.log(`[Router] Calling adapter.authorizeWith3DS()`, { requestId })

  const authorizeOutput = await adapter.authorizeWith3DS({
    paymentIntentId,
    requestId,
    acquirerRoute: route,
    authenticationResult, // PaRes
    authenticationTransactionId: threeDSData.authenticationTransactionId,
    merchantData,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  })

  console.log(`[Router] 3DS authorization outcome: ${authorizeOutput.outcome}`, {
    requestId,
  })

  // STEP 7: Handle authorization outcome
  if (authorizeOutput.outcome === 'failed') {
    // Authorization failed
    console.log(`[Router] 3DS authorization failed`, {
      requestId,
      code: authorizeOutput.processorResponse?.code,
      message: authorizeOutput.processorResponse?.message,
    })

    // Update PaymentIntent status to failed
    const { data: failedPI } = await supabase
      .from('payment_intents')
      .update({ status: 'failed' })
      .eq('id', paymentIntentId)
      .select()
      .single()

    // Create charge record with failed status
    const failedCharge = mapAuthorizeOutputToCharge(
      authorizeOutput,
      paymentIntent,
      route
    )

    const { data: charge } = await supabase
      .from('charges')
      .insert(failedCharge)
      .select()
      .single()

    // Emit events
    await emitEvent({
      supabase,
      merchantId,
      eventType: 'payment_intent.failed',
      data: failedPI,
      env,
    }).catch((err) => console.error('[Router] Error emitting event:', err))

    await emitEvent({
      supabase,
      merchantId,
      eventType: 'charge.failed',
      data: charge,
      env,
    }).catch((err) => console.error('[Router] Error emitting event:', err))

    throw new Error(
      authorizeOutput.processorResponse?.message || '3DS authentication failed'
    )
  }

  // STEP 8: Authorization successful
  console.log(`[Router] 3DS authorization successful`, {
    requestId,
    amountAuthorized: authorizeOutput.amountAuthorized,
    authCode: authorizeOutput.authorizationCode,
  })

  // Create charge record
  const chargeData = mapAuthorizeOutputToCharge(
    authorizeOutput,
    paymentIntent,
    route
  )

  const { data: charge, error: chargeError } = await supabase
    .from('charges')
    .insert(chargeData)
    .select()
    .single()

  if (chargeError || !charge) {
    throw new Error(`Failed to create charge: ${chargeError?.message}`)
  }

  // Emit charge.authorized event
  await emitEvent({
    supabase,
    merchantId,
    eventType: 'charge.authorized',
    data: charge,
    env,
  }).catch((err) => console.error('[Router] Error emitting event:', err))

  // Update PaymentIntent status
  const newStatus =
    paymentIntent.capture_method === 'automatic' ? 'succeeded' : 'processing'

  const { data: updatedPI } = await supabase
    .from('payment_intents')
    .update({ status: newStatus })
    .eq('id', paymentIntentId)
    .select()
    .single()

  console.log(`[Router] Payment intent 3DS authentication completed successfully`, {
    requestId,
    status: newStatus,
    chargeId: charge.id,
  })

  // Emit event for webhooks
  await emitEvent({
    supabase,
    merchantId,
    eventType: 'payment_intent.succeeded',
    data: updatedPI,
    env,
  }).catch((err) =>
    console.error('[Router] Error emitting event:', err)
  )

  return {
    paymentIntent: updatedPI,
    charge,
  }
}

// ============================================================================
// VOID CHARGE
// ============================================================================

/**
 * Void (cancel) a pre-authorized payment
 *
 * FLOW:
 * 1. Fetch Charge from DB
 * 2. Validate it can be voided
 * 3. Get adapter
 * 4. Map to canonical format
 * 5. Call adapter.void()
 * 6. Update charge status
 * 7. Update payment intent
 * 8. Emit events
 *
 * @param params - Void parameters
 * @returns Void result
 * @throws Error if validation fails or adapter errors
 */
export async function voidCharge(
  params: VoidChargeParams
): Promise<VoidChargeResult> {
  const { supabase, chargeId, merchantId, requestId, env } = params

  console.log(`[Router] Voiding charge ${chargeId}`, { requestId })

  // STEP 1: Fetch charge
  const { data: charge, error: fetchError } = await supabase
    .from('charges')
    .select('*')
    .eq('id', chargeId)
    .eq('merchant_id', merchantId)
    .single()

  if (fetchError || !charge) {
    throw new Error(`Charge not found: ${chargeId}`)
  }

  // STEP 2: Validate charge can be voided
  validateChargeForVoid(charge)

  // STEP 3: Get adapter
  const adapterName = charge.acquirer_name || env.DEFAULT_ADAPTER || 'mock'
  const adapter = getAdapter(adapterName)

  // Check if adapter supports void
  if (!adapter.void) {
    throw new Error(`Adapter ${adapterName} does not support void operation`)
  }

  // STEP 4: Map to canonical void input
  const voidInput = mapChargeToVoidInput(charge, requestId)

  // STEP 5: Call adapter to void
  console.log(`[Router] Calling adapter.void()`, { requestId })
  const voidOutput = await adapter.void(voidInput)

  if (voidOutput.outcome !== 'voided') {
    throw new Error(voidOutput.processorResponse?.message || 'Void failed')
  }

  console.log(`[Router] Void successful`, { requestId })

  // STEP 6: Update charge status
  const { data: updatedCharge } = await supabase
    .from('charges')
    .update({ status: 'voided' })
    .eq('id', chargeId)
    .select()
    .single()

  // STEP 7: Update payment intent status
  const { data: updatedPI } = await supabase
    .from('payment_intents')
    .update({ status: 'canceled' })
    .eq('id', charge.payment_intent_id)
    .select()
    .single()

  console.log(`[Router] Charge voided successfully`, {
    requestId,
    chargeId,
    paymentIntentId: charge.payment_intent_id,
  })

  // Emit events
  await emitEvent({
    supabase,
    merchantId,
    eventType: 'charge.voided',
    data: updatedCharge,
  }).catch((err) => console.error('[Router] Error emitting event:', err))

  await emitEvent({
    supabase,
    merchantId,
    eventType: 'payment_intent.canceled',
    data: updatedPI,
  }).catch((err) => console.error('[Router] Error emitting event:', err))

  return {
    charge: updatedCharge,
    paymentIntent: updatedPI,
  }
}
