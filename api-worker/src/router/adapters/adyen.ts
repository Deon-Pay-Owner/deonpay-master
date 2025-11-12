/**
 * Adyen Acquirer Adapter
 *
 * Integración con Adyen Payment Platform
 *
 * DOCUMENTACIÓN:
 * - API Reference: https://docs.adyen.com/api-explorer/
 * - Payments API: https://docs.adyen.com/online-payments/
 * - Classic Integration: https://docs.adyen.com/online-payments/classic-integrations/api-integration-ecommerce
 *
 * CREDENCIALES NECESARIAS:
 * - apiKey: X-API-Key para autenticación
 * - merchantAccount: Tu merchant account name
 * - endpoint: https://checkout-test.adyen.com (test) o https://checkout-live.adyen.com (prod)
 * - liveEndpointUrlPrefix: Para producción (ej: 1797a841fbb37ca7-AdyenDemo)
 *
 * FLOW DE AUTORIZACIÓN:
 * 1. POST /v70/payments - Crear payment
 * 2. Response incluye: resultCode, pspReference, merchantReference
 * 3. Si requiere 3DS: action.type === 'redirect' o 'threeDS2'
 *
 * CONFIGURACIÓN EN merchant.routing_config:
 * ```json
 * {
 *   "adapters": {
 *     "adyen": {
 *       "enabled": true,
 *       "merchantRef": "YourMerchantAccountCOM",
 *       "config": {
 *         "apiKey": "AQE...",
 *         "merchantAccount": "YourMerchantAccountCOM",
 *         "endpoint": "https://checkout-test.adyen.com",
 *         "liveEndpointUrlPrefix": null
 *       }
 *     }
 *   }
 * }
 * ```
 */

import type { AcquirerAdapter } from './index'
import type {
  CanonicalAuthorizeInput,
  CanonicalAuthorizeOutput,
  CanonicalCaptureInput,
  CanonicalCaptureOutput,
  CanonicalRefundInput,
  CanonicalRefundOutput,
  CanonicalVoidInput,
  CanonicalVoidOutput,
  CanonicalEvent,
} from './types'

// ============================================================================
// ADYEN TYPES
// ============================================================================

type AdyenConfig = {
  apiKey: string
  merchantAccount: string
  endpoint: string
  liveEndpointUrlPrefix?: string | null
}

type AdyenPaymentRequest = {
  amount: {
    value: number // Amount in minor units
    currency: string
  }
  reference: string // Our payment intent ID
  merchantAccount: string
  paymentMethod: {
    type: 'scheme' // For card payments
    encryptedCardNumber?: string
    encryptedExpiryMonth?: string
    encryptedExpiryYear?: string
    encryptedSecurityCode?: string
    // Or use stored payment method:
    storedPaymentMethodId?: string
  }
  returnUrl?: string // For 3DS redirect
  shopperInteraction?: 'Ecommerce' | 'ContAuth' | 'Moto'
  recurringProcessingModel?: 'CardOnFile' | 'Subscription' | 'UnscheduledCardOnFile'
  shopperEmail?: string
  shopperName?: {
    firstName?: string
    lastName?: string
  }
  browserInfo?: {
    // Required for 3DS2
    userAgent: string
    acceptHeader: string
    language: string
    colorDepth: number
    screenHeight: number
    screenWidth: number
    timeZoneOffset: number
    javaEnabled: boolean
  }
  channel?: 'Web' | 'iOS' | 'Android'
  origin?: string // For web payments
  captureDelayHours?: number // If > 0, delayed capture
}

type AdyenPaymentResponse = {
  pspReference: string // Adyen's transaction ID
  resultCode:
    | 'Authorised'
    | 'Refused'
    | 'RedirectShopper'
    | 'IdentifyShopper'
    | 'ChallengeShopper'
    | 'Pending'
    | 'Received'
    | 'Error'
  merchantReference: string
  amount?: {
    value: number
    currency: string
  }
  refusalReason?: string
  refusalReasonCode?: string
  additionalData?: {
    // Extra info from processor
    authCode?: string
    avsResult?: string
    cvcResult?: string
    cardBin?: string
    cardSummary?: string
    expiryDate?: string
    paymentMethod?: string
    [key: string]: any
  }
  action?: {
    // For 3DS or other required actions
    type: 'redirect' | 'threeDS2' | 'voucher' | 'qrCode'
    url?: string
    method?: 'GET' | 'POST'
    data?: Record<string, string>
    paymentData?: string
    token?: string
  }
}

// ============================================================================
// ADYEN ADAPTER
// ============================================================================

export const adyenAdapter: AcquirerAdapter = {
  name: 'adyen',

  /**
   * Authorize payment with Adyen
   *
   * API ENDPOINT: POST /v70/payments
   * DOC: https://docs.adyen.com/api-explorer/Checkout/70/post/payments
   */
  async authorize(
    input: CanonicalAuthorizeInput
  ): Promise<CanonicalAuthorizeOutput> {
    console.log(
      `[Adyen Adapter] Authorizing payment for PI ${input.paymentIntentId}`,
      {
        requestId: input.requestId,
        amount: input.amount,
        currency: input.currency,
      }
    )

    // Extract configuration
    const config = extractConfig(input)

    // TODO: Build Adyen payment request
    // const adyenRequest: AdyenPaymentRequest = {
    //   amount: {
    //     value: input.amount,
    //     currency: input.currency.toUpperCase(),
    //   },
    //   reference: input.paymentIntentId,
    //   merchantAccount: config.merchantAccount,
    //   paymentMethod: {
    //     type: 'scheme',
    //     // For encrypted card data (if using Adyen Web Drop-in):
    //     encryptedCardNumber: 'adyenjs_0_1_25$...',
    //     encryptedExpiryMonth: 'adyenjs_0_1_25$...',
    //     encryptedExpiryYear: 'adyenjs_0_1_25$...',
    //     encryptedSecurityCode: 'adyenjs_0_1_25$...',
    //     // Or use tokenization:
    //     // storedPaymentMethodId: input.paymentMethod.tokenization?.tokenRef,
    //   },
    //   shopperInteraction: 'Ecommerce',
    //   returnUrl: 'https://your-site.com/payment/return', // For 3DS
    //   shopperEmail: input.customer?.email,
    //   captureDelayHours: input.acquirerRoute.config?.captureDelayHours || undefined,
    //   channel: 'Web',
    //   origin: 'https://your-site.com',
    // }

    // TODO: Make HTTP POST request
    // const response = await fetch(`${config.endpoint}/v70/payments`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'X-API-Key': config.apiKey,
    //   },
    //   body: JSON.stringify(adyenRequest),
    // })

    // TODO: Parse response
    // const adyenResponse: AdyenPaymentResponse = await response.json()

    // TODO: Map to canonical format
    // switch (adyenResponse.resultCode) {
    //   case 'Authorised':
    //     return {
    //       outcome: 'authorized',
    //       amountAuthorized: input.amount,
    //       acquirerReference: adyenResponse.pspReference,
    //       authorizationCode: adyenResponse.additionalData?.authCode,
    //       network: mapAdyenCardBrand(adyenResponse.additionalData?.paymentMethod),
    //       processorResponse: {
    //         code: '00',
    //         message: 'Authorised',
    //         avs: adyenResponse.additionalData?.avsResult,
    //         cvv: adyenResponse.additionalData?.cvcResult,
    //       },
    //       vendorRaw: adyenResponse,
    //     }
    //
    //   case 'RedirectShopper':
    //   case 'ChallengeShopper':
    //   case 'IdentifyShopper':
    //     // 3DS or other action required
    //     return {
    //       outcome: 'requires_action',
    //       acquirerReference: adyenResponse.pspReference,
    //       threeDS: {
    //         flow: 'challenge',
    //         redirectUrl: adyenResponse.action?.url,
    //         data: {
    //           paymentData: adyenResponse.action?.paymentData,
    //           token: adyenResponse.action?.token,
    //         },
    //       },
    //       processorResponse: {
    //         code: 'REQUIRES_ACTION',
    //         message: adyenResponse.resultCode,
    //       },
    //       vendorRaw: adyenResponse,
    //     }
    //
    //   case 'Refused':
    //   case 'Error':
    //     return {
    //       outcome: 'failed',
    //       acquirerReference: adyenResponse.pspReference,
    //       processorResponse: {
    //         code: adyenResponse.refusalReasonCode || 'REFUSED',
    //         message: adyenResponse.refusalReason || 'Payment refused',
    //       },
    //       vendorRaw: adyenResponse,
    //     }
    //
    //   default:
    //     throw new Error(`Unknown Adyen resultCode: ${adyenResponse.resultCode}`)
    // }

    // Placeholder - implementar lógica real
    throw new Error(
      'Adyen adapter not yet implemented. Waiting for credentials from Adyen.'
    )
  },

  /**
   * Capture previously authorized payment
   *
   * API ENDPOINT: POST /v70/payments/{pspReference}/captures
   * DOC: https://docs.adyen.com/api-explorer/Checkout/70/post/payments/{paymentPspReference}/captures
   */
  async capture(
    input: CanonicalCaptureInput
  ): Promise<CanonicalCaptureOutput> {
    console.log(`[Adyen Adapter] Capturing charge ${input.chargeId}`, {
      requestId: input.requestId,
      amountToCapture: input.amountToCapture,
    })

    // TODO: Extract configuration
    // const config = extractConfigFromContext(input)

    // TODO: Build capture request
    // const captureRequest = {
    //   amount: {
    //     value: input.amountToCapture,
    //     currency: 'MXN', // TODO: Get from charge
    //   },
    //   merchantAccount: config.merchantAccount,
    //   reference: input.chargeId,
    // }

    // TODO: POST to /v70/payments/{pspReference}/captures
    // const response = await fetch(
    //   `${config.endpoint}/v70/payments/${input.acquirerReference}/captures`,
    //   {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'X-API-Key': config.apiKey,
    //     },
    //     body: JSON.stringify(captureRequest),
    //   }
    // )

    // TODO: Parse and map response
    // Adyen capture is async, returns: { pspReference, status: 'received' }

    throw new Error('Adyen capture not yet implemented')
  },

  /**
   * Refund captured payment
   *
   * API ENDPOINT: POST /v70/payments/{pspReference}/refunds
   * DOC: https://docs.adyen.com/api-explorer/Checkout/70/post/payments/{paymentPspReference}/refunds
   */
  async refund(input: CanonicalRefundInput): Promise<CanonicalRefundOutput> {
    console.log(`[Adyen Adapter] Refunding charge ${input.chargeId}`, {
      requestId: input.requestId,
      amount: input.amount,
    })

    // TODO: Implement refund logic
    // POST to /v70/payments/{pspReference}/refunds
    // Similar structure to capture

    throw new Error('Adyen refund not yet implemented')
  },

  /**
   * Cancel/reverse authorization
   *
   * API ENDPOINT: POST /v70/payments/{pspReference}/cancels
   * DOC: https://docs.adyen.com/api-explorer/Checkout/70/post/payments/{paymentPspReference}/cancels
   */
  async void(input: CanonicalVoidInput): Promise<CanonicalVoidOutput> {
    console.log(`[Adyen Adapter] Voiding charge ${input.chargeId}`, {
      requestId: input.requestId,
    })

    // TODO: Implement cancel/void logic
    // POST to /v70/payments/{pspReference}/cancels

    throw new Error('Adyen void not yet implemented')
  },

  /**
   * Handle webhook from Adyen
   *
   * DOC: https://docs.adyen.com/development-resources/webhooks/
   * Standard Webhooks: AUTHORISATION, CAPTURE, REFUND, CANCELLATION, etc.
   */
  async handleWebhook(
    rawBody: any,
    headers: Record<string, string>
  ): Promise<CanonicalEvent[]> {
    console.log(`[Adyen Adapter] Processing webhook`)

    // TODO: Verify webhook HMAC signature
    // Adyen sends signature in: notificationItems[].NotificationRequestItem.additionalData.hmacSignature
    // Calculate HMAC using: pspReference + originalReference + merchantAccountCode + merchantReference + value + currency + eventCode + success
    // const isValid = verifyAdyenWebhookSignature(rawBody, config.hmacKey)
    // if (!isValid) {
    //   throw new Error('Invalid Adyen webhook signature')
    // }

    // TODO: Parse webhook notification items
    // Adyen sends: { notificationItems: [{ NotificationRequestItem: {...} }] }
    // eventCode can be: AUTHORISATION, CAPTURE, REFUND, CANCELLATION, etc.

    // TODO: Convert to canonical events
    // const events: CanonicalEvent[] = []
    // for (const item of rawBody.notificationItems) {
    //   const notification = item.NotificationRequestItem
    //   const eventCode = notification.eventCode
    //   const success = notification.success === 'true'
    //
    //   if (eventCode === 'AUTHORISATION' && success) {
    //     events.push({
    //       type: 'payment_intent.succeeded',
    //       data: { /* map from notification */ }
    //     })
    //   }
    //   // ... map other events
    // }

    return []
  },
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract Adyen config from acquirer route
 */
function extractConfig(input: CanonicalAuthorizeInput): AdyenConfig {
  const config = input.acquirerRoute.config as any

  if (!config?.apiKey || !config?.merchantAccount) {
    throw new Error(
      'Adyen config incomplete. Required: apiKey, merchantAccount, endpoint'
    )
  }

  return {
    apiKey: config.apiKey,
    merchantAccount: config.merchantAccount,
    endpoint: config.endpoint || 'https://checkout-test.adyen.com',
    liveEndpointUrlPrefix: config.liveEndpointUrlPrefix,
  }
}

/**
 * Map Adyen card brand to canonical network
 */
function mapAdyenCardBrand(brand?: string): string {
  const brandMap: Record<string, string> = {
    visa: 'visa',
    mc: 'mastercard',
    amex: 'amex',
    discover: 'discover',
    maestro: 'mastercard',
  }

  return brandMap[brand?.toLowerCase() || ''] || 'unknown'
}

/**
 * Verify Adyen webhook HMAC signature
 */
function verifyAdyenWebhookSignature(
  notification: any,
  hmacKey: string
): boolean {
  // TODO: Implement HMAC verification
  // 1. Build signature string from notification fields
  // 2. Calculate HMAC-SHA256 with hmacKey
  // 3. Compare with notification.additionalData.hmacSignature

  // Signature string format:
  // pspReference + originalReference + merchantAccountCode + merchantReference + value + currency + eventCode + success

  return false
}

// ============================================================================
// NOTES FOR IMPLEMENTATION
// ============================================================================

/**
 * PASOS PARA COMPLETAR LA INTEGRACIÓN:
 *
 * 1. OBTENER CREDENCIALES DE ADYEN:
 *    - Crear cuenta en https://ca-test.adyen.com (test) o https://ca-live.adyen.com (prod)
 *    - Generar API Key en: Developers > API credentials
 *    - Obtener Merchant Account name
 *    - Para webhooks: generar HMAC key
 *
 * 2. CONFIGURAR EN BASE DE DATOS:
 *    - Agregar config en merchants.routing_config
 *    - Incluir: apiKey, merchantAccount, endpoint, hmacKey (para webhooks)
 *
 * 3. MANEJAR TOKENIZACIÓN:
 *    - Opción 1: Usar Adyen Web Drop-in (genera encrypted card data)
 *    - Opción 2: Usar Adyen Tokenization (stored payment methods)
 *    - Opción 3: Network tokenization (si soportado)
 *
 * 4. IMPLEMENTAR 3DS2:
 *    - Incluir browserInfo en request (para frictionless flow)
 *    - Manejar action.type === 'threeDS2' o 'redirect'
 *    - Después de 3DS, llamar POST /payments/details con paymentData
 *
 * 5. CAPTURE/REFUND/CANCEL:
 *    - Todas son operaciones asíncronas en Adyen
 *    - Response inicial: status 'received'
 *    - Confirmación final llega vía webhook
 *    - Implementar polling o webhook handling
 *
 * 6. WEBHOOKS:
 *    - Configurar URL en Adyen portal: https://api.deonpay.mx/webhooks/adyen
 *    - Verificar HMAC signature SIEMPRE
 *    - Responder [accepted] para confirmar recepción
 *    - Procesar eventos: AUTHORISATION, CAPTURE, REFUND, CANCELLATION
 *
 * 7. TESTING:
 *    - Tarjetas de prueba: https://docs.adyen.com/development-resources/testing/test-card-numbers
 *    - 3DS test: 4212345678901237 (challenge flow)
 *    - Endpoint test: https://checkout-test.adyen.com
 *
 * RECURSOS:
 * - API Explorer: https://docs.adyen.com/api-explorer/
 * - Postman Collection: https://docs.adyen.com/development-resources/postman/
 * - SDK (opcional): https://github.com/Adyen/adyen-node-api-library
 * - Web Drop-in: https://docs.adyen.com/online-payments/build-your-integration/
 */
