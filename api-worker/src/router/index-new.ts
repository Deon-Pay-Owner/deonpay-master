/**
 * Router Orchestrator
 *
 * Main entry point for processing payments through multi-acquirer system.
 * Coordinates routing, adapters, mappers, and database operations.
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

export type ConfirmPaymentIntentParams = {
  supabase: SupabaseClient
  paymentIntentId: string
  merchantId: string
  requestId: string
  rawPaymentMethod?: RawPaymentMethod
  billingDetails?: BillingDetails
  env: {
    DEFAULT_ADAPTER?: string
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
  }
}

export type VoidChargeResult = {
  charge: Charge
  paymentIntent: PaymentIntent
}

// ============================================================================
// CONFIRM PAYMENT INTENT (Authorize + Optional Capture)
// ============================================================================

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
        })
        .eq('id', paymentIntentId)
        .select()
        .single()

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

// Export other functions unchanged...
export { captureCharge, refundCharge, voidCharge } from './index'
