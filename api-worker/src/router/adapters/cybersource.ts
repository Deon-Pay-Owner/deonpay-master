/**
 * CyberSource Acquirer Adapter
 *
 * Integración con CyberSource Payment Gateway
 *
 * DOCUMENTACIÓN:
 * - REST API: https://developer.cybersource.com/api-reference-assets/index.html
 * - Guía: https://developer.cybersource.com/docs/cybs/en-us/payments/developer/all/rest/payments/payments-intro.html
 *
 * CREDENCIALES NECESARIAS (del merchant account):
 * - merchantId: Tu merchant ID de CyberSource
 * - apiKey: API Key (merchant_id)
 * - secretKey: Secret Key para firma HMAC
 * - endpoint: https://apitest.cybersource.com (test) o https://api.cybersource.com (prod)
 *
 * FLOW DE AUTORIZACIÓN:
 * 1. POST /pts/v2/payments - Crear authorization
 * 2. Response incluye: id, status, processorInformation
 * 3. Si requiere 3DS: consumer_authentication_information
 *
 * CONFIGURACIÓN EN merchant.routing_config:
 * ```json
 * {
 *   "adapters": {
 *     "cybersource": {
 *       "enabled": true,
 *       "merchantRef": "your_merchant_id",
 *       "config": {
 *         "apiKey": "merchant_id",
 *         "secretKey": "shared_secret_key",
 *         "endpoint": "https://apitest.cybersource.com",
 *         "runEnvironment": "apitest.cybersource.com"
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
// CYBERSOURCE TYPES
// ============================================================================

type CyberSourceConfig = {
  merchantId: string
  apiKey: string
  secretKey: string
  endpoint: string
  runEnvironment: string
}

type CyberSourceAuthRequest = {
  clientReferenceInformation: {
    code: string // Our payment intent ID
  }
  processingInformation: {
    capture?: boolean // true = auth + capture, false = auth only
    commerceIndicator?: string // For 3DS: 'internet' or 'moto'
  }
  orderInformation: {
    amountDetails: {
      totalAmount: string // e.g., "10.99"
      currency: string // ISO 4217
    }
    billTo?: {
      firstName?: string
      lastName?: string
      email?: string
      address1?: string
      address2?: string
      locality?: string
      administrativeArea?: string
      postalCode?: string
      country?: string
    }
  }
  paymentInformation: {
    card: {
      number: string
      expirationMonth: string // "12"
      expirationYear: string // "2025"
      securityCode?: string
    }
  }
  consumerAuthenticationInformation?: {
    // For 3DS
    cavv?: string
    eciRaw?: string
    paresStatus?: string
    veresEnrolled?: string
    xid?: string
  }
}

type CyberSourceAuthResponse = {
  id: string // Transaction ID
  status: 'AUTHORIZED' | 'DECLINED' | 'INVALID_REQUEST' | 'PENDING_AUTHENTICATION'
  submitTimeUtc: string
  clientReferenceInformation?: {
    code: string
  }
  processorInformation?: {
    approvalCode?: string
    responseCode?: string
    networkTransactionId?: string
    avs?: {
      code?: string
      codeRaw?: string
    }
    cardVerification?: {
      resultCode?: string
    }
  }
  orderInformation?: {
    amountDetails?: {
      authorizedAmount?: string
      currency?: string
    }
  }
  consumerAuthenticationInformation?: {
    // For 3DS
    acsUrl?: string
    paReq?: string
    authenticationTransactionId?: string
    veresEnrolled?: string
  }
  errorInformation?: {
    reason: string
    message: string
  }
}

// ============================================================================
// CYBERSOURCE ADAPTER
// ============================================================================

export const cyberSourceAdapter: AcquirerAdapter = {
  name: 'cybersource',

  /**
   * Authorize payment with CyberSource
   *
   * API ENDPOINT: POST /pts/v2/payments
   * DOC: https://developer.cybersource.com/api-reference-assets/index.html#payments_payments_process-a-payment
   */
  async authorize(
    input: CanonicalAuthorizeInput
  ): Promise<CanonicalAuthorizeOutput> {
    console.log(
      `[CyberSource Adapter] Authorizing payment for PI ${input.paymentIntentId}`,
      {
        requestId: input.requestId,
        amount: input.amount,
        currency: input.currency,
      }
    )

    // Extract configuration
    const config = extractConfig(input)

    // Build CyberSource request
    const csRequest: CyberSourceAuthRequest = {
      clientReferenceInformation: {
        code: input.paymentIntentId,
      },
      processingInformation: {
        capture: false, // Authorization only (capture later)
        commerceIndicator: 'internet',
      },
      orderInformation: {
        amountDetails: {
          totalAmount: (input.amount / 100).toFixed(2),
          currency: input.currency.toUpperCase(),
        },
        billTo: {
          firstName: input.customer?.name?.split(' ')[0] || input.billingAddress?.line1?.split(' ')[0] || 'Guest',
          lastName: input.customer?.name?.split(' ').slice(1).join(' ') || 'User',
          email: input.customer?.email || 'customer@example.com',
          address1: input.billingAddress?.line1,
          address2: input.billingAddress?.line2,
          locality: input.billingAddress?.city,
          administrativeArea: input.billingAddress?.state,
          postalCode: input.billingAddress?.postalCode || '00000',
          country: input.billingAddress?.country || 'MX',
        },
      },
      paymentInformation: {
        card: {
          number: input.paymentMethod.cardNumber || '4111111111111111',
          expirationMonth: input.paymentMethod.expMonth?.toString().padStart(2, '0') || '12',
          expirationYear: input.paymentMethod.expYear?.toString() || '2025',
          securityCode: input.paymentMethod.cvv || '123',
        },
      },
    }

    // Add 3DS information if present
    if (input.threeDS?.cavv) {
      csRequest.consumerAuthenticationInformation = {
        cavv: input.threeDS.cavv,
        eciRaw: input.threeDS.eci,
      }
    }

    // Prepare headers
    const requestBody = JSON.stringify(csRequest)
    const date = new Date().toUTCString()
    const path = '/pts/v2/payments'
    const digest = await generateDigest(requestBody)
    const signature = await generateCyberSourceSignature('POST', path, date, digest, config)

    // Make HTTP POST request to CyberSource
    try {
      console.log('[CyberSource Adapter] Making request to CyberSource:', {
        endpoint: config.endpoint + path,
        merchantId: config.merchantId,
      })

      console.log('[CyberSource Adapter] Request details:', {
        date,
        digest,
        requestBodyLength: requestBody.length,
        requestBodyPreview: requestBody.substring(0, 200) + '...',
      })

      console.log('[CyberSource Adapter] Signature:', signature)

      console.log('[CyberSource Adapter] Config:', {
        merchantId: config.merchantId,
        apiKey: config.apiKey,
        runEnvironment: config.runEnvironment,
        endpoint: config.endpoint,
      })
      
      const response = await fetch(`${config.endpoint}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'v-c-merchant-id': config.merchantId,
          'Date': date,
          'Host': config.runEnvironment,
          'Digest': digest,
          'Signature': signature,
        },
        body: requestBody,
      })

      const responseText = await response.text()
      console.log('[CyberSource Adapter] Raw response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText,
      })

      let csResponse: CyberSourceAuthResponse
      try {
        csResponse = JSON.parse(responseText)
      } catch (e) {
        console.error('[CyberSource Adapter] Failed to parse response as JSON:', responseText)
        throw new Error(`Invalid JSON response from CyberSource: ${responseText}`)
      }

      console.log('[CyberSource Adapter] Parsed response:', {
        status: response.status,
        responseStatus: csResponse.status,
        errorInfo: csResponse.errorInformation,
        processorInfo: csResponse.processorInformation,
      })

      console.log('[CyberSource Adapter] Response:', {
        status: csResponse.status,
        id: csResponse.id,
      })

      // Map to canonical format based on status
      if (csResponse.status === 'AUTHORIZED') {
        return {
          outcome: 'authorized',
          amountAuthorized: input.amount,
          acquirerReference: csResponse.id,
          authorizationCode: csResponse.processorInformation?.approvalCode,
          network: mapCardNetwork(input.paymentMethod.network),
          processorResponse: {
            code: csResponse.processorInformation?.responseCode || '00',
            message: 'Authorized',
            avs: csResponse.processorInformation?.avs?.code,
            cvv: csResponse.processorInformation?.cardVerification?.resultCode,
          },
          vendorRaw: csResponse,
        }
      }

      if (csResponse.status === 'PENDING_AUTHENTICATION') {
        // 3DS challenge required
        return {
          outcome: 'requires_action',
          acquirerReference: csResponse.id,
          threeDS: {
            flow: 'challenge',
            redirectUrl: csResponse.consumerAuthenticationInformation?.acsUrl,
            data: {
              paReq: csResponse.consumerAuthenticationInformation?.paReq,
              authenticationTransactionId:
                csResponse.consumerAuthenticationInformation?.authenticationTransactionId,
            },
          },
          vendorRaw: csResponse,
        }
      }

      // DECLINED or other failure
      return {
        outcome: 'failed',
        processorResponse: {
          code: csResponse.processorInformation?.responseCode || 'error',
          message:
            csResponse.errorInformation?.message ||
            csResponse.processorInformation?.responseCode ||
            'Payment declined',
        },
        vendorRaw: csResponse,
      }
    } catch (error: any) {
      console.error('[CyberSource Adapter] Error:', error)
      throw new Error(`CyberSource API error: ${error.message}`)
    }
  },

  /**
   * Capture previously authorized payment
   *
   * API ENDPOINT: POST /pts/v2/payments/{id}/captures
   * DOC: https://developer.cybersource.com/api-reference-assets/index.html#payments_capture_capture-a-payment
   */
  async capture(
    input: CanonicalCaptureInput
  ): Promise<CanonicalCaptureOutput> {
    console.log(`[CyberSource Adapter] Capturing charge ${input.chargeId}`, {
      requestId: input.requestId,
      amountToCapture: input.amountToCapture,
    })

    // Extract configuration from acquirer route
    const config = extractConfig({
      acquirerRoute: input.acquirerRoute,
    } as any)

    // Build capture request
    const captureRequest = {
      clientReferenceInformation: {
        code: input.chargeId,
      },
      orderInformation: {
        amountDetails: {
          totalAmount: (input.amountToCapture / 100).toFixed(2),
          currency: input.currency || 'MXN',
        },
      },
    }

    // Prepare headers
    const requestBody = JSON.stringify(captureRequest)
    const date = new Date().toUTCString()
    const path = `/pts/v2/payments/${input.acquirerReference}/captures`
    const digest = await generateDigest(requestBody)
    const signature = await generateCyberSourceSignature('POST', path, date, digest, config)

    try {
      const response = await fetch(`${config.endpoint}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'v-c-merchant-id': config.merchantId,
          'Date': date,
          'Host': config.runEnvironment,
          'Digest': digest,
          'Signature': signature,
        },
        body: requestBody,
      })

      const csResponse: any = await response.json()

      console.log('[CyberSource Adapter] Capture response:', {
        status: csResponse.status,
        id: csResponse.id,
      })

      if (csResponse.status === 'PENDING') {
        return {
          outcome: 'succeeded',
          amountCaptured: input.amountToCapture,
          acquirerReference: csResponse.id,
          vendorRaw: csResponse,
        }
      }

      // Handle failure
      throw new Error(
        csResponse.errorInformation?.message || 'Capture failed'
      )
    } catch (error: any) {
      console.error('[CyberSource Adapter] Capture error:', error)
      throw new Error(`CyberSource capture error: ${error.message}`)
    }
  },

  /**
   * Refund captured payment
   *
   * API ENDPOINT: POST /pts/v2/payments/{id}/refunds
   * DOC: https://developer.cybersource.com/api-reference-assets/index.html#payments_refund_refund-a-payment
   */
  async refund(input: CanonicalRefundInput): Promise<CanonicalRefundOutput> {
    console.log(`[CyberSource Adapter] Refunding charge ${input.chargeId}`, {
      requestId: input.requestId,
      amount: input.amount,
    })

    // Extract configuration from acquirer route
    const config = extractConfig({
      acquirerRoute: input.acquirerRoute,
    } as any)

    // Build refund request
    const refundRequest = {
      clientReferenceInformation: {
        code: input.refundId,
      },
      orderInformation: {
        amountDetails: {
          totalAmount: (input.amount / 100).toFixed(2),
          currency: input.currency || 'MXN',
        },
      },
    }

    // Prepare headers
    const requestBody = JSON.stringify(refundRequest)
    const date = new Date().toUTCString()
    const path = `/pts/v2/payments/${input.acquirerReference}/refunds`
    const digest = await generateDigest(requestBody)
    const signature = await generateCyberSourceSignature('POST', path, date, digest, config)

    try {
      const response = await fetch(`${config.endpoint}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'v-c-merchant-id': config.merchantId,
          'Date': date,
          'Host': config.runEnvironment,
          'Digest': digest,
          'Signature': signature,
        },
        body: requestBody,
      })

      const csResponse: any = await response.json()

      console.log('[CyberSource Adapter] Refund response:', {
        status: csResponse.status,
        id: csResponse.id,
      })

      if (csResponse.status === 'PENDING') {
        return {
          outcome: 'succeeded',
          amountRefunded: input.amount,
          acquirerReference: csResponse.id,
          vendorRaw: csResponse,
        }
      }

      // Handle failure
      throw new Error(
        csResponse.errorInformation?.message || 'Refund failed'
      )
    } catch (error: any) {
      console.error('[CyberSource Adapter] Refund error:', error)
      throw new Error(`CyberSource refund error: ${error.message}`)
    }
  },

  /**
   * Void authorization
   *
   * API ENDPOINT: POST /pts/v2/payments/{id}/voids
   * DOC: https://developer.cybersource.com/api-reference-assets/index.html#payments_void_void-a-payment
   */
  async void(input: CanonicalVoidInput): Promise<CanonicalVoidOutput> {
    console.log(`[CyberSource Adapter] Voiding charge ${input.chargeId}`, {
      requestId: input.requestId,
    })

    // Extract configuration from acquirer route
    const config = extractConfig({
      acquirerRoute: input.acquirerRoute,
    } as any)

    // Build void request
    const voidRequest = {
      clientReferenceInformation: {
        code: input.chargeId,
      },
    }

    // Prepare headers
    const requestBody = JSON.stringify(voidRequest)
    const date = new Date().toUTCString()
    const path = `/pts/v2/payments/${input.acquirerReference}/voids`
    const digest = await generateDigest(requestBody)
    const signature = await generateCyberSourceSignature('POST', path, date, digest, config)

    try {
      const response = await fetch(`${config.endpoint}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'v-c-merchant-id': config.merchantId,
          'Date': date,
          'Host': config.runEnvironment,
          'Digest': digest,
          'Signature': signature,
        },
        body: requestBody,
      })

      const csResponse: any = await response.json()

      console.log('[CyberSource Adapter] Void response:', {
        status: csResponse.status,
        id: csResponse.id,
      })

      if (csResponse.status === 'VOIDED' || csResponse.status === 'REVERSED') {
        return {
          outcome: 'succeeded',
          acquirerReference: csResponse.id,
          vendorRaw: csResponse,
        }
      }

      // Handle failure
      throw new Error(
        csResponse.errorInformation?.message || 'Void failed'
      )
    } catch (error: any) {
      console.error('[CyberSource Adapter] Void error:', error)
      throw new Error(`CyberSource void error: ${error.message}`)
    }
  },

  /**
   * Handle webhook from CyberSource
   *
   * DOC: https://developer.cybersource.com/docs/cybs/en-us/platform/developer/all/rest/payments/webhook-intro.html
   */
  async handleWebhook(
    rawBody: any,
    headers: Record<string, string>
  ): Promise<CanonicalEvent[]> {
    console.log(`[CyberSource Adapter] Processing webhook`)

    // TODO: Verify webhook signature
    // const signature = headers['x-cybersource-signature']
    // const isValid = verifyCyberSourceWebhook(rawBody, signature)
    // if (!isValid) {
    //   throw new Error('Invalid webhook signature')
    // }

    // TODO: Parse webhook and convert to canonical events
    // CyberSource sends different event types:
    // - decision.manager.review (fraud review)
    // - payment.authorization.created
    // - payment.capture.created
    // - payment.refund.created

    return []
  },
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract CyberSource config from acquirer route
 */
function extractConfig(input: CanonicalAuthorizeInput): CyberSourceConfig {
  const config = input.acquirerRoute.config as any

  // Si no hay config, usar credenciales por defecto de sandbox
  const merchantId = config?.merchantId || 'deon_pay_1761432252'
  const apiKey = config?.apiKey || 'dd960ee9-6c12-490d-bd69-de31766459be'
  const secretKey = config?.secretKey || 'VhV22d0gPVoS+XzAcdsogJpmDfUOFEj5QWVk6lhr/+Y='

  return {
    merchantId,
    apiKey,
    secretKey,
    endpoint: config?.endpoint || 'https://apitest.cybersource.com',
    runEnvironment: config?.runEnvironment || 'apitest.cybersource.com',
  }
}

/**
 * Generate HMAC signature for CyberSource API
 *
 * CyberSource usa HTTP Signature Authentication (RFC draft)
 * Ver: https://developer.cybersource.com/docs/cybs/en-us/platform/developer/all/rest/platform/authentication/http-signature-auth.html
 */
async function generateCyberSourceSignature(
  method: string,
  path: string,
  date: string,
  digest: string,
  config: CyberSourceConfig
): Promise<string> {
  // Build signature string from headers
  // Format: "header-name: value\nheader-name: value"
  const signatureString = [
    `host: ${config.runEnvironment}`,
    `date: ${date}`,
    `request-target: ${method.toLowerCase()} ${path}`,
    `digest: ${digest}`,
    `v-c-merchant-id: ${config.merchantId}`,
  ].join('\n')

  // Generate HMAC-SHA256 signature
  const encoder = new TextEncoder()
  // Decode secret key from Base64 (as required by CyberSource)
  const secretKeyBytes = Uint8Array.from(atob(config.secretKey), c => c.charCodeAt(0))
  const secretKey = await crypto.subtle.importKey(
    'raw',
    secretKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    encoder.encode(signatureString)
  )

  // Convert to base64
  const signatureArray = Array.from(new Uint8Array(signatureBuffer))
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray))

  // Build Signature header
  // Format: keyid="...", algorithm="HmacSHA256", headers="...", signature="..."
  return [
    `keyid="${config.apiKey}"`,
    `algorithm="HmacSHA256"`,
    `headers="host date request-target digest v-c-merchant-id"`,
    `signature="${signatureBase64}"`,
  ].join(', ')
}

/**
 * Generate SHA-256 digest for request body
 */
async function generateDigest(body: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(body)

  const hashBuffer = await crypto.subtle.digest('SHA-256', data)

  // Convert to base64
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashBase64 = btoa(String.fromCharCode(...hashArray))

  return `SHA-256=${hashBase64}`
}

/**
 * Map card network to CyberSource format
 */
function mapCardNetwork(network?: string): string {
  const networkMap: Record<string, string> = {
    visa: 'VISA',
    mastercard: 'MASTERCARD',
    amex: 'AMERICAN_EXPRESS',
    discover: 'DISCOVER',
  }

  return networkMap[network?.toLowerCase() || ''] || 'UNKNOWN'
}

// ============================================================================
// NOTES FOR IMPLEMENTATION
// ============================================================================

/**
 * PASOS PARA COMPLETAR LA INTEGRACIÓN:
 *
 * 1. CONFIGURAR CREDENCIALES:
 *    - Obtener merchant_id, api_key, secret_key de CyberSource portal
 *    - Configurar en merchants.routing_config en DB
 *
 * 2. IMPLEMENTAR HMAC SIGNATURE:
 *    - Seguir spec de HTTP Signature Authentication
 *    - Usar crypto.subtle.sign() con HMAC-SHA256
 *    - Ver ejemplo en webhook dispatcher
 *
 * 3. IMPLEMENTAR AUTHORIZE:
 *    - Construir CyberSourceAuthRequest
 *    - Generar signature
 *    - POST a /pts/v2/payments
 *    - Mapear response a CanonicalAuthorizeOutput
 *    - Manejar diferentes status: AUTHORIZED, DECLINED, PENDING_AUTHENTICATION
 *
 * 4. IMPLEMENTAR CAPTURE/REFUND/VOID:
 *    - Similar a authorize pero endpoints diferentes
 *    - /pts/v2/payments/{id}/captures
 *    - /pts/v2/payments/{id}/refunds
 *    - /pts/v2/payments/{id}/voids
 *
 * 5. MANEJAR 3DS:
 *    - Si response.status === 'PENDING_AUTHENTICATION'
 *    - Usar consumerAuthenticationInformation.acsUrl
 *    - Redirigir cliente para challenge
 *    - Después de 3DS, reenviar authorize con CAVV
 *
 * 6. TESTING:
 *    - Usar tarjetas de prueba de CyberSource
 *    - Test cards: https://developer.cybersource.com/hello-world/testing-guide/test-card-numbers.html
 *    - Endpoint test: https://apitest.cybersource.com
 *
 * 7. WEBHOOKS:
 *    - Configurar webhook URL en CyberSource portal
 *    - Implementar verificación de signature
 *    - Mapear eventos a canonical format
 *
 * RECURSOS:
 * - SDK (si prefieres usar SDK): https://github.com/CyberSource/cybersource-rest-client-node
 * - Postman Collection: https://developer.cybersource.com/api/developer-guides/dita-gettingstarted/authentication/createSharedKey.html
 */
