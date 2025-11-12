/**
 * Mock Acquirer Adapter
 *
 * Adapter de prueba que simula respuestas exitosas sin hacer llamadas reales.
 * Útil para:
 * - Tests E2E locales
 * - Desarrollo sin necesidad de credenciales reales
 * - Validación de flujos de integración
 *
 * COMPORTAMIENTO:
 * - Todas las autorizaciones son exitosas (authorized)
 * - Todas las capturas son exitosas (captured)
 * - Todos los reembolsos son exitosos (succeeded)
 * - Genera referencias mock consistentes
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

/**
 * Mock Adapter Implementation
 */
export const mockAdapter: AcquirerAdapter = {
  name: 'mock',

  /**
   * Simula una autorización exitosa
   */
  async authorize(
    input: CanonicalAuthorizeInput
  ): Promise<CanonicalAuthorizeOutput> {
    console.log(
      `[Mock Adapter] Authorizing payment for PI ${input.paymentIntentId}`,
      {
        requestId: input.requestId,
        amount: input.amount,
        currency: input.currency,
      }
    )

    // Simular delay de red (50-150ms)
    await sleep(50 + Math.random() * 100)

    // Generar referencia mock consistente
    const acquirerReference = `MOCK-${input.paymentIntentId.substring(0, 8).toUpperCase()}-${Date.now()}`

    // Simular diferentes outcomes basado en el monto para testing
    // Montos específicos pueden forzar diferentes comportamientos:
    // - 666 = requires_action (3DS)
    // - 999 = failed
    // - otros = authorized
    if (input.amount === 66600) {
      // Centavos, equivale a 666.00
      console.log(`[Mock Adapter] Simulating 3DS challenge required`)
      return {
        outcome: 'requires_action',
        acquirerReference,
        threeDS: {
          flow: 'challenge',
          redirectUrl: 'https://mock-3ds.deonpay.mx/challenge',
          data: {
            mockChallengeId: `challenge_${Date.now()}`,
          },
        },
        processorResponse: {
          code: '3DS_REQUIRED',
          message: '3D Secure authentication required',
        },
        vendorRaw: {
          mockAdapter: true,
          simulatedScenario: '3DS_CHALLENGE',
        },
      }
    }

    if (input.amount === 99900) {
      // Centavos, equivale a 999.00
      console.log(`[Mock Adapter] Simulating card declined`)
      return {
        outcome: 'failed',
        acquirerReference,
        processorResponse: {
          code: '05',
          message: 'Do not honor',
          cvv: 'M', // Match
          avs: 'Y', // Match
        },
        vendorRaw: {
          mockAdapter: true,
          simulatedScenario: 'CARD_DECLINED',
        },
      }
    }

    // Caso exitoso (default)
    console.log(
      `[Mock Adapter] Authorization successful: ${acquirerReference}`
    )
    return {
      outcome: 'authorized',
      amountAuthorized: input.amount,
      acquirerReference,
      authorizationCode: '999999', // Código mock
      network: input.paymentMethod.network || 'visa',
      processorResponse: {
        code: '00', // Approval code
        message: 'Approved',
        cvv: 'M', // Match
        avs: 'Y', // Full match (address + zip)
      },
      vendorRaw: {
        mockAdapter: true,
        simulatedScenario: 'SUCCESS',
        timestamp: new Date().toISOString(),
      },
    }
  },

  /**
   * Simula una captura exitosa
   */
  async capture(
    input: CanonicalCaptureInput
  ): Promise<CanonicalCaptureOutput> {
    console.log(`[Mock Adapter] Capturing charge ${input.chargeId}`, {
      requestId: input.requestId,
      amountToCapture: input.amountToCapture,
    })

    // Simular delay de red
    await sleep(50 + Math.random() * 100)

    // En mock, siempre captura exitosamente
    console.log(`[Mock Adapter] Capture successful`)
    return {
      outcome: 'captured',
      amountCaptured: input.amountToCapture,
      processorResponse: {
        code: '00',
        message: 'Capture successful',
      },
      vendorRaw: {
        mockAdapter: true,
        simulatedScenario: 'CAPTURE_SUCCESS',
        timestamp: new Date().toISOString(),
      },
    }
  },

  /**
   * Simula un reembolso exitoso
   */
  async refund(input: CanonicalRefundInput): Promise<CanonicalRefundOutput> {
    console.log(`[Mock Adapter] Refunding charge ${input.chargeId}`, {
      requestId: input.requestId,
      amount: input.amount,
      reason: input.reason,
    })

    // Simular delay de red
    await sleep(50 + Math.random() * 100)

    // Generar referencia de refund
    const acquirerReference = `MOCK-REFUND-${input.chargeId.substring(0, 8).toUpperCase()}-${Date.now()}`

    console.log(`[Mock Adapter] Refund successful: ${acquirerReference}`)
    return {
      outcome: 'succeeded',
      acquirerReference,
      processorResponse: {
        code: '00',
        message: 'Refund processed',
      },
      vendorRaw: {
        mockAdapter: true,
        simulatedScenario: 'REFUND_SUCCESS',
        timestamp: new Date().toISOString(),
      },
    }
  },

  /**
   * Simula una anulación exitosa
   */
  async void(input: CanonicalVoidInput): Promise<CanonicalVoidOutput> {
    console.log(`[Mock Adapter] Voiding charge ${input.chargeId}`, {
      requestId: input.requestId,
    })

    // Simular delay de red
    await sleep(50 + Math.random() * 100)

    console.log(`[Mock Adapter] Void successful`)
    return {
      outcome: 'voided',
      processorResponse: {
        code: '00',
        message: 'Authorization voided',
      },
      vendorRaw: {
        mockAdapter: true,
        simulatedScenario: 'VOID_SUCCESS',
        timestamp: new Date().toISOString(),
      },
    }
  },

  /**
   * Mock no procesa webhooks (no aplica)
   */
  async handleWebhook(
    rawBody: any,
    headers: Record<string, string>
  ): Promise<CanonicalEvent[]> {
    console.log(`[Mock Adapter] Webhook handling not implemented (mock adapter)`)
    return []
  },
}

/**
 * Helper para simular delay asíncrono
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// TESTING UTILITIES
// ============================================================================

/**
 * Montos especiales para testing (en centavos):
 *
 * - 66600 (666.00): Simula 3DS challenge required
 * - 99900 (999.00): Simula card declined
 * - Cualquier otro: Simula approval exitoso
 *
 * @example
 * ```typescript
 * // Forzar 3DS challenge
 * const pi = await createPaymentIntent({ amount: 66600 })
 *
 * // Forzar decline
 * const pi = await createPaymentIntent({ amount: 99900 })
 * ```
 */
export const MOCK_TEST_AMOUNTS = {
  SUCCESS: 10000, // 100.00 - Aprobado
  REQUIRES_3DS: 66600, // 666.00 - Requiere 3DS
  DECLINED: 99900, // 999.00 - Rechazado
} as const
