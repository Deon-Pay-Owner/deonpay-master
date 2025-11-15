/**
 * Acquirer Adapter Interface & Registry
 *
 * Define la interfaz estándar que todos los adapters deben implementar
 * y proporciona un registry central para gestionar adapters disponibles.
 *
 * USAGE:
 * 1. Implementa AcquirerAdapter en tu adapter (mock.ts, adyen.ts, etc.)
 * 2. Registra el adapter: registerAdapter(myAdapter)
 * 3. Obtén el adapter: getAdapter('mock')
 */

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
// ACQUIRER ADAPTER INTERFACE
// ============================================================================

/**
 * Interfaz que todos los adapters de acquirers deben implementar.
 *
 * Cada método debe:
 * - Recibir inputs canónicos (neutrales al vendor)
 * - Devolver outputs canónicos
 * - Lanzar AdapterError en caso de error
 * - Logear con requestId para traceabilidad
 */
export interface AcquirerAdapter {
  /**
   * Nombre único del adapter (usado como identificador)
   * Ejemplos: 'mock', 'adyen', 'stripe', 'conekta', 'cybersource'
   */
  name: string

  /**
   * Autorizar un pago (pre-autorización o autorización directa)
   *
   * @param input - Datos canónicos del pago
   * @returns Resultado de la autorización
   * @throws AdapterAuthorizationError si falla
   */
  authorize(input: CanonicalAuthorizeInput): Promise<CanonicalAuthorizeOutput>

  /**
   * Capturar un pago previamente autorizado
   *
   * @param input - Datos de la captura
   * @returns Resultado de la captura
   * @throws AdapterError si falla
   */
  capture(input: CanonicalCaptureInput): Promise<CanonicalCaptureOutput>

  /**
   * Reembolsar un pago capturado
   *
   * @param input - Datos del reembolso
   * @returns Resultado del reembolso
   * @throws AdapterError si falla
   */
  refund(input: CanonicalRefundInput): Promise<CanonicalRefundOutput>

  /**
   * Anular una pre-autorización (opcional, no todos los acquirers lo soportan)
   *
   * @param input - Datos de la anulación
   * @returns Resultado de la anulación
   * @throws AdapterError si falla o no está implementado
   */
  void?(input: CanonicalVoidInput): Promise<CanonicalVoidOutput>

  /**
   * Completar autenticación 3DS (opcional, para acquirers con soporte 3DS)
   *
   * @param input - Datos de la autenticación 3DS
   * @returns Resultado de la autorización
   * @throws AdapterError si falla
   */
  authorizeWith3DS?(input: {
    paymentIntentId: string
    requestId: string
    acquirerRoute: any
    authenticationResult: string
    authenticationTransactionId?: string
    merchantData?: string
    amount: number
    currency: string
  }): Promise<CanonicalAuthorizeOutput>

  /**
   * Procesar webhook recibido del acquirer (opcional)
   *
   * Convierte el webhook raw del acquirer a eventos canónicos.
   *
   * @param rawBody - Body raw del webhook
   * @param headers - Headers HTTP del webhook
   * @returns Array de eventos canónicos extraídos del webhook
   * @throws AdapterError si la firma es inválida o el webhook es malformado
   */
  handleWebhook?(
    rawBody: any,
    headers: Record<string, string>
  ): Promise<CanonicalEvent[]>
}

// ============================================================================
// ADAPTER REGISTRY
// ============================================================================

/**
 * Registry global de adapters disponibles
 * Key: nombre del adapter (ej: 'mock', 'adyen')
 * Value: instancia del adapter
 */
type AdapterRegistry = Record<string, AcquirerAdapter>

const registry: AdapterRegistry = {}

/**
 * Registra un adapter en el registry global
 *
 * @param adapter - Instancia del adapter a registrar
 * @throws Error si ya existe un adapter con ese nombre
 *
 * @example
 * ```typescript
 * const mockAdapter: AcquirerAdapter = {
 *   name: 'mock',
 *   authorize: async (input) => ({ outcome: 'authorized' }),
 *   // ...
 * }
 * registerAdapter(mockAdapter)
 * ```
 */
export function registerAdapter(adapter: AcquirerAdapter): void {
  if (registry[adapter.name]) {
    console.warn(
      `[Adapter Registry] Adapter "${adapter.name}" already registered, overwriting`
    )
  }

  console.log(`[Adapter Registry] Registered adapter: ${adapter.name}`)
  registry[adapter.name] = adapter
}

/**
 * Obtiene un adapter del registry por nombre
 *
 * @param name - Nombre del adapter a obtener
 * @returns Instancia del adapter
 * @throws Error si el adapter no existe
 *
 * @example
 * ```typescript
 * const adapter = getAdapter('mock')
 * const result = await adapter.authorize(input)
 * ```
 */
export function getAdapter(name: string): AcquirerAdapter {
  const adapter = registry[name]

  if (!adapter) {
    const availableAdapters = Object.keys(registry).join(', ') || 'none'
    throw new Error(
      `[Adapter Registry] Adapter "${name}" not found. Available adapters: ${availableAdapters}`
    )
  }

  return adapter
}

/**
 * Lista todos los adapters registrados
 *
 * @returns Array con nombres de adapters disponibles
 */
export function listAdapters(): string[] {
  return Object.keys(registry)
}

/**
 * Verifica si un adapter está registrado
 *
 * @param name - Nombre del adapter
 * @returns true si el adapter existe
 */
export function hasAdapter(name: string): boolean {
  return name in registry
}

/**
 * Limpia el registry (útil para tests)
 * ⚠️ NO usar en producción
 */
export function clearRegistry(): void {
  Object.keys(registry).forEach(key => delete registry[key])
  console.log('[Adapter Registry] Registry cleared')
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Re-exportar tipos para conveniencia
export type {
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

export { AdapterAuthorizationError } from './types'
