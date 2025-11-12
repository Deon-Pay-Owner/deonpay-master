/**
 * Mapper Utilities
 *
 * Converts between DeonPay canonical PaymentIntent format and adapter formats.
 *
 * FLOW:
 * 1. PaymentIntent (DB) → CanonicalAuthorizeInput (adapter input)
 * 2. CanonicalAuthorizeOutput (adapter output) → Charge (DB)
 *
 * USAGE:
 * ```typescript
 * const authorizeInput = mapPIToAuthorizeInput(paymentIntent, requestId, route)
 * const result = await adapter.authorize(authorizeInput)
 * const charge = mapAuthorizeOutputToCharge(result, paymentIntent)
 * ```
 */

import type { PaymentIntent, PaymentMethod, Charge } from '../schemas/canonical'
import type {
  CanonicalAuthorizeInput,
  CanonicalAuthorizeOutput,
  CanonicalCaptureInput,
  CanonicalRefundInput,
  CanonicalVoidInput,
} from './adapters/types'
import type { RouteSelection } from './routing-strategy'

// ============================================================================
// PAYMENT INTENT → AUTHORIZE INPUT
// ============================================================================

/**
 * Convert PaymentIntent to CanonicalAuthorizeInput
 *
 * Maps DeonPay's PaymentIntent format to the canonical adapter input format.
 *
 * @param paymentIntent - The payment intent from database
 * @param requestId - Request ID for tracing
 * @param route - Selected route (adapter, merchantRef, config)
 * @param rawPaymentMethod - Raw card data (for processing only, not stored)
 * @param billingDetails - Billing information
 * @returns CanonicalAuthorizeInput for adapter
 * @throws Error if payment_method is missing
 */
export function mapPIToAuthorizeInput(
  paymentIntent: PaymentIntent,
  requestId: string,
  route: RouteSelection,
  rawPaymentMethod?: {
    type: 'card'
    number: string
    exp_month: number
    exp_year: number
    cvv: string
  },
  billingDetails?: {
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
): CanonicalAuthorizeInput {
  // Validate payment method exists
  if (!paymentIntent.payment_method) {
    throw new Error(
      `Payment method is required for payment intent ${paymentIntent.id}`
    )
  }

  const pm = paymentIntent.payment_method

  // Map PaymentMethod to canonical payment method format
  const canonicalPaymentMethod: CanonicalAuthorizeInput['paymentMethod'] = {
    type: 'card',
    network: pm?.brand ? mapCardBrandToNetwork(pm.brand) : undefined,
    brand: pm?.brand,
    last4: pm?.last4,
    expMonth: pm?.exp_month || rawPaymentMethod?.exp_month,
    expYear: pm?.exp_year || rawPaymentMethod?.exp_year,
    // Add raw card data if provided (for direct processing)
    cardNumber: rawPaymentMethod?.number,
    cvv: rawPaymentMethod?.cvv,
  }

  // Add tokenization info if available
  if (pm.token_ref) {
    canonicalPaymentMethod.tokenization = {
      type: 'network_token',
      tokenRef: pm.token_ref,
    }
  }

  // Build canonical authorize input
  const authorizeInput: CanonicalAuthorizeInput = {
    requestId,
    merchantId: paymentIntent.merchant_id,
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    paymentMethod: canonicalPaymentMethod,
    acquirerRoute: {
      adapter: route.adapter,
      merchantRef: route.merchantRef,
      config: route.config,
    },
    metadata: paymentIntent.metadata || {},
  }

  // Add customer info if available
  if (paymentIntent.customer_id || billingDetails) {
    authorizeInput.customer = {
      id: paymentIntent.customer_id || undefined,
      name: billingDetails?.name,
      email: billingDetails?.email,
    }
  }

  // Add billing address
  if (billingDetails?.address) {
    authorizeInput.billingAddress = {
      line1: billingDetails.address.line1,
      line2: billingDetails.address.line2,
      city: billingDetails.address.city,
      state: billingDetails.address.state,
      postalCode: billingDetails.address.postal_code,
      country: billingDetails.address.country,
    }
  }

  // Add description if available
  if (paymentIntent.description) {
    authorizeInput.statementDescriptor = paymentIntent.description
  }

  return authorizeInput
}

/**
 * Map card brand to network name
 * Normalizes brand names to network identifiers
 */
function mapCardBrandToNetwork(
  brand: string
): 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown' {
  const brandLower = brand.toLowerCase()

  switch (brandLower) {
    case 'visa':
      return 'visa'
    case 'mastercard':
      return 'mastercard'
    case 'amex':
    case 'american_express':
      return 'amex'
    case 'discover':
      return 'discover'
    default:
      return 'unknown'
  }
}

// ============================================================================
// AUTHORIZE OUTPUT → CHARGE
// ============================================================================

/**
 * Convert CanonicalAuthorizeOutput to Charge database row
 *
 * Maps adapter authorization result to DeonPay's Charge format for database storage.
 *
 * @param output - Authorization result from adapter
 * @param paymentIntent - Original payment intent
 * @param route - Route used for authorization
 * @returns Partial Charge object for database insertion
 */
export function mapAuthorizeOutputToCharge(
  output: CanonicalAuthorizeOutput,
  paymentIntent: PaymentIntent,
  route: RouteSelection
): Omit<Charge, 'id' | 'created_at' | 'updated_at'> {
  // Determine charge status based on outcome
  let status: Charge['status']
  let amountCaptured = 0

  switch (output.outcome) {
    case 'authorized':
      // Check if automatic capture
      if (paymentIntent.capture_method === 'automatic') {
        status = 'captured'
        amountCaptured = output.amountAuthorized || paymentIntent.amount
      } else {
        status = 'authorized'
        amountCaptured = 0
      }
      break

    case 'requires_action':
      // Payment requires 3DS or other action, should not create charge yet
      // This case should be handled by the orchestrator before calling this mapper
      throw new Error(
        'Cannot create charge for authorization requiring action. Handle 3DS flow first.'
      )

    case 'failed':
      status = 'failed'
      amountCaptured = 0
      break

    default:
      throw new Error(`Unknown authorization outcome: ${output.outcome}`)
  }

  // Build processor response
  const processorResponse = output.processorResponse
    ? {
        code: output.processorResponse.code || 'UNKNOWN',
        message: output.processorResponse.message || 'No message',
        avs_result: output.processorResponse.avs || null,
        cvc_check: mapCvcResult(output.processorResponse.cvv),
        raw_response: output.vendorRaw || {},
      }
    : null

  // Build charge object
  const charge: Omit<Charge, 'id' | 'created_at' | 'updated_at'> = {
    merchant_id: paymentIntent.merchant_id,
    payment_intent_id: paymentIntent.id,
    amount_authorized: output.amountAuthorized || paymentIntent.amount,
    amount_captured: amountCaptured,
    amount_refunded: 0,
    currency: paymentIntent.currency,
    status,
    processor_response: processorResponse,
    acquirer_name: route.adapter,
    acquirer_reference: output.acquirerReference || null,
    authorization_code: output.authorizationCode || null,
    network: output.network || null,
    description: paymentIntent.description || null,
    metadata: paymentIntent.metadata || {},
  }

  return charge
}

/**
 * Map CVV check result to canonical format
 */
function mapCvcResult(
  cvv?: string
): 'pass' | 'fail' | 'unavailable' | 'unchecked' | null {
  if (!cvv) return null

  const cvvUpper = cvv.toUpperCase()

  switch (cvvUpper) {
    case 'M': // Match
    case 'Y': // Yes
      return 'pass'
    case 'N': // No match
      return 'fail'
    case 'P': // Not processed
    case 'U': // Unavailable
    case 'S': // Should be on card but wasn't provided
      return 'unavailable'
    case 'X': // Not checked
      return 'unchecked'
    default:
      return null
  }
}

// ============================================================================
// CHARGE → CAPTURE INPUT
// ============================================================================

/**
 * Convert Charge to CanonicalCaptureInput
 *
 * @param charge - Charge from database
 * @param requestId - Request ID for tracing
 * @param amountToCapture - Optional amount (if not specified, captures all)
 * @returns CanonicalCaptureInput for adapter
 */
export function mapChargeToCaptureInput(
  charge: Charge,
  requestId: string,
  amountToCapture?: number
): CanonicalCaptureInput {
  return {
    requestId,
    merchantId: charge.merchant_id,
    paymentIntentId: charge.payment_intent_id,
    chargeId: charge.id,
    amountToCapture: amountToCapture || charge.amount_authorized,
    acquirerReference: charge.acquirer_reference || undefined,
  }
}

// ============================================================================
// CHARGE → REFUND INPUT
// ============================================================================

/**
 * Convert Charge to CanonicalRefundInput
 *
 * @param charge - Charge from database
 * @param requestId - Request ID for tracing
 * @param amount - Amount to refund (in minor units)
 * @param reason - Reason for refund
 * @returns CanonicalRefundInput for adapter
 */
export function mapChargeToRefundInput(
  charge: Charge,
  requestId: string,
  amount: number,
  reason?: string
): CanonicalRefundInput {
  return {
    requestId,
    merchantId: charge.merchant_id,
    chargeId: charge.id,
    amount,
    reason,
    acquirerReference: charge.acquirer_reference || undefined,
  }
}

// ============================================================================
// CHARGE → VOID INPUT
// ============================================================================

/**
 * Convert Charge to CanonicalVoidInput
 *
 * @param charge - Charge from database
 * @param requestId - Request ID for tracing
 * @returns CanonicalVoidInput for adapter
 */
export function mapChargeToVoidInput(
  charge: Charge,
  requestId: string
): CanonicalVoidInput {
  return {
    requestId,
    merchantId: charge.merchant_id,
    chargeId: charge.id,
    acquirerReference: charge.acquirer_reference || undefined,
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate that a payment intent can be authorized
 *
 * @param paymentIntent - Payment intent to validate
 * @throws Error if validation fails
 */
export function validatePaymentIntentForAuthorization(
  paymentIntent: PaymentIntent
): void {
  // Check status
  if (paymentIntent.status !== 'requires_payment_method') {
    throw new Error(
      `Cannot authorize payment intent with status: ${paymentIntent.status}`
    )
  }

  // Check payment method
  if (!paymentIntent.payment_method) {
    throw new Error('Payment method is required')
  }

  // Check amount
  if (paymentIntent.amount <= 0) {
    throw new Error('Amount must be greater than zero')
  }
}

/**
 * Validate that a charge can be captured
 *
 * @param charge - Charge to validate
 * @throws Error if validation fails
 */
export function validateChargeForCapture(charge: Charge): void {
  if (charge.status !== 'authorized') {
    throw new Error(`Cannot capture charge with status: ${charge.status}`)
  }

  if (charge.amount_authorized <= 0) {
    throw new Error('Authorized amount must be greater than zero')
  }
}

/**
 * Validate that a charge can be refunded
 *
 * @param charge - Charge to validate
 * @param amount - Amount to refund
 * @throws Error if validation fails
 */
export function validateChargeForRefund(charge: Charge, amount: number): void {
  if (charge.status !== 'captured' && charge.status !== 'partially_refunded') {
    throw new Error(`Cannot refund charge with status: ${charge.status}`)
  }

  const remainingAmount = charge.amount_captured - charge.amount_refunded
  if (amount > remainingAmount) {
    throw new Error(
      `Refund amount (${amount}) exceeds remaining captured amount (${remainingAmount})`
    )
  }

  if (amount <= 0) {
    throw new Error('Refund amount must be greater than zero')
  }
}

/**
 * Validate that a charge can be voided
 *
 * @param charge - Charge to validate
 * @throws Error if validation fails
 */
export function validateChargeForVoid(charge: Charge): void {
  if (charge.status !== 'authorized') {
    throw new Error(`Cannot void charge with status: ${charge.status}`)
  }
}
