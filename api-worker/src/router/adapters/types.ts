/**
 * Canonical Adapter Types
 *
 * Tipos neutros y estandarizados para comunicación con acquirers.
 * Estos tipos NO deben depender de implementaciones específicas de acquirers.
 *
 * MAPPING NOTE:
 * - merchant_id viene del contexto de autenticación (apiKeyAuth middleware)
 * - requestId viene del requestId middleware
 * - payment_intent_id se obtiene de la tabla payment_intents
 * - charge_id se obtiene de la tabla charges
 */

// ============================================================================
// AUTHORIZE (Create payment / Pre-authorization)
// ============================================================================

export type CanonicalAuthorizeInput = {
  requestId: string                    // from requestId middleware
  merchantId: string                   // from apiKeyAuth middleware
  paymentIntentId: string             // payment_intents.id
  amount: number                      // minor units (centavos)
  currency: string                    // ISO-4217 (MXN, USD, etc.)

  paymentMethod: {
    type: 'card'                      // Solo tarjetas por ahora
    network?: string                  // visa, mastercard, amex
    brand?: string                    // visa, mastercard_credit, etc.
    last4?: string                    // últimos 4 dígitos
    expMonth?: number                 // 1-12
    expYear?: number                  // 2024, 2025, etc.
    cardNumber?: string               // Full card number (for processing only, not stored)
    cvv?: string                      // CVV/CVC code (for processing only, not stored)
    tokenization?: {
      type: 'network_token' | 'vault' | 'none'
      tokenRef?: string               // token del acquirer o vault
    }
  }

  customer?: {
    id?: string                       // customers.id (UUID)
    email?: string
    name?: string
  }

  billingAddress?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  threeDS?: {
    required?: boolean
    version?: string                  // '2.2.0', '2.1.0', etc.
    eci?: string                      // Electronic Commerce Indicator
    cavv?: string                     // Cardholder Authentication Verification Value
    flow?: 'frictionless' | 'challenge'
    browser?: any                     // Browser info for 3DS2
  }

  statementDescriptor?: string       // Texto que aparece en estado de cuenta

  acquirerRoute: {
    adapter: string                   // 'mock', 'adyen', 'stripe', etc.
    merchantRef?: string              // Merchant account ID en el acquirer
    config?: Record<string, any>      // Configuración específica del adapter
  }

  metadata?: Record<string, any>     // Metadata arbitraria del merchant
}

export type CanonicalAuthorizeOutput = {
  outcome: 'authorized' | 'requires_action' | 'failed'
  amountAuthorized?: number          // Amount autorizado en minor units
  acquirerReference?: string         // PSP reference (para capture/refund/void)
  authorizationCode?: string         // Código de autorización del banco
  network?: string                   // Red que procesó (visa, mastercard)

  threeDS?: {
    flow?: 'challenge' | 'frictionless'
    redirectUrl?: string             // URL para redirigir al cliente (challenge)
    methodUrl?: string               // URL para 3DS method (iframe)
    data?: any                       // Datos adicionales para 3DS
  }

  processorResponse?: {
    code?: string                    // Código de respuesta del processor
    message?: string                 // Mensaje del processor
    avs?: string                     // AVS check result
    cvv?: string                     // CVV check result
  }

  vendorRaw?: any                    // Respuesta raw del acquirer (debug)
}

// ============================================================================
// CAPTURE (Capture pre-authorized payment)
// ============================================================================

export type CanonicalCaptureInput = {
  requestId: string
  merchantId: string
  paymentIntentId: string
  chargeId: string                   // charges.id
  amountToCapture?: number           // Si no se especifica, captura todo
  acquirerReference?: string         // De la autorización
}

export type CanonicalCaptureOutput = {
  outcome: 'captured' | 'failed'
  amountCaptured?: number            // Amount capturado en minor units
  processorResponse?: {
    code?: string
    message?: string
  }
  vendorRaw?: any
}

// ============================================================================
// REFUND (Reverse captured payment)
// ============================================================================

export type CanonicalRefundInput = {
  requestId: string
  merchantId: string
  chargeId: string                   // charges.id
  amount: number                     // minor units
  reason?: string                    // 'requested_by_customer', 'duplicate', 'fraudulent'
  acquirerReference?: string         // De la captura
}

export type CanonicalRefundOutput = {
  outcome: 'succeeded' | 'failed' | 'pending'
  acquirerReference?: string         // Reference del refund
  processorResponse?: {
    code?: string
    message?: string
  }
  vendorRaw?: any
}

// ============================================================================
// VOID (Cancel pre-authorized payment)
// ============================================================================

export type CanonicalVoidInput = {
  requestId: string
  merchantId: string
  chargeId: string
  acquirerReference?: string
}

export type CanonicalVoidOutput = {
  outcome: 'voided' | 'failed'
  processorResponse?: {
    code?: string
    message?: string
  }
  vendorRaw?: any
}

// ============================================================================
// WEBHOOK EVENTS (Canonical format)
// ============================================================================

export type CanonicalEvent =
  | {
      type: 'payment_intent.succeeded' | 'payment_intent.failed' | 'payment_intent.requires_action'
      data: {
        payment_intent_id: string
        amount: number
        currency: string
        status: string
        [key: string]: any
      }
    }
  | {
      type: 'charge.captured' | 'charge.refunded' | 'charge.voided' | 'charge.failed'
      data: {
        charge_id: string
        payment_intent_id: string
        amount: number
        currency: string
        status: string
        [key: string]: any
      }
    }
  | {
      type: 'refund.succeeded' | 'refund.failed'
      data: {
        refund_id: string
        charge_id: string
        amount: number
        currency: string
        status: string
        [key: string]: any
      }
    }

// ============================================================================
// ADAPTER ERROR
// ============================================================================

export interface AdapterError extends Error {
  code?: string                      // Error code (card_declined, processing_error, etc.)
  acquirerCode?: string              // Código del acquirer
  acquirerMessage?: string           // Mensaje del acquirer
  retryable?: boolean                // Si el error es retry-able
  vendorRaw?: any                    // Respuesta raw para debugging
}

export class AdapterAuthorizationError extends Error implements AdapterError {
  code: string
  acquirerCode?: string
  acquirerMessage?: string
  retryable: boolean
  vendorRaw?: any

  constructor(
    message: string,
    options: {
      code?: string
      acquirerCode?: string
      acquirerMessage?: string
      retryable?: boolean
      vendorRaw?: any
    } = {}
  ) {
    super(message)
    this.name = 'AdapterAuthorizationError'
    this.code = options.code || 'authorization_failed'
    this.acquirerCode = options.acquirerCode
    this.acquirerMessage = options.acquirerMessage
    this.retryable = options.retryable || false
    this.vendorRaw = options.vendorRaw
  }
}
