/**
 * Routing Strategy Selector
 *
 * Determines which acquirer adapter to use for processing a payment.
 *
 * STRATEGIES:
 * 1. DEFAULT: Use selected_route from PaymentIntent or env.DEFAULT_ADAPTER
 * 2. RULES: Route based on merchant-defined rules (TODO: future implementation)
 * 3. SMART: ML-based routing optimization (TODO: future implementation)
 *
 * USAGE:
 * ```typescript
 * const route = await pickRoute(paymentIntent, merchantConfig, env)
 * const adapter = getAdapter(route.adapter)
 * const result = await adapter.authorize(...)
 * ```
 */

import type { PaymentIntent, AcquirerRouting } from '../schemas/canonical'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Route selection result
 * Contains the adapter name and acquirer-specific configuration
 */
export type RouteSelection = {
  adapter: string                    // Adapter name ('mock', 'adyen', 'stripe', etc.)
  merchantRef?: string               // Merchant account ID at the acquirer
  config?: Record<string, any>       // Adapter-specific configuration
}

/**
 * Routing strategy types
 */
export type RoutingStrategy = 'default' | 'rules' | 'smart'

/**
 * Merchant configuration for routing
 * Stored in merchants.routing_config JSONB column
 */
export type MerchantRoutingConfig = {
  strategy?: RoutingStrategy         // Which strategy to use
  defaultAdapter?: string            // Fallback adapter if not specified
  adapters?: {                       // Available adapters for this merchant
    [adapterName: string]: {
      enabled: boolean
      merchantRef?: string           // Merchant ID at acquirer
      priority?: number              // Lower = higher priority
      config?: Record<string, any>   // Adapter-specific config
    }
  }
  rules?: RoutingRule[]              // Rules-based routing (future)
  smartConfig?: SmartRoutingConfig   // ML routing config (future)
}

/**
 * Rules-based routing rule (future implementation)
 */
export type RoutingRule = {
  id: string
  name: string
  enabled: boolean
  conditions: {
    amount?: { min?: number; max?: number }
    currency?: string[]
    cardBrand?: string[]
    cardType?: ('credit' | 'debit')[]
    country?: string[]
    threeDS?: boolean
  }
  action: {
    adapter: string
    merchantRef?: string
    config?: Record<string, any>
  }
}

/**
 * Smart routing configuration (future implementation)
 */
export type SmartRoutingConfig = {
  enabled: boolean
  modelVersion?: string
  weights?: {
    costOptimization?: number        // 0-1: Optimize for lowest fees
    approvalRate?: number            // 0-1: Optimize for approval rate
    latency?: number                 // 0-1: Optimize for speed
  }
}

// ============================================================================
// MAIN ROUTING FUNCTION
// ============================================================================

/**
 * Pick the optimal route for processing a payment
 *
 * Decision flow:
 * 1. Check if PaymentIntent has pre-selected route (acquirer_routing.selected_route)
 * 2. Use merchant's configured strategy (default, rules, or smart)
 * 3. Fallback to env.DEFAULT_ADAPTER or 'mock'
 *
 * @param paymentIntent - The payment intent to route
 * @param merchantConfig - Merchant routing configuration
 * @param env - Environment variables (for DEFAULT_ADAPTER)
 * @returns RouteSelection with adapter name and config
 * @throws Error if no valid adapter can be selected
 */
export async function pickRoute(
  paymentIntent: PaymentIntent,
  merchantConfig: MerchantRoutingConfig | null,
  env: { DEFAULT_ADAPTER?: string }
): Promise<RouteSelection> {
  console.log(
    `[Routing Strategy] Selecting route for PI ${paymentIntent.id}`,
    {
      merchantId: paymentIntent.merchant_id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      strategy: merchantConfig?.strategy || 'default',
    }
  )

  // STEP 1: Check if PaymentIntent has pre-selected route
  const selectedRoute = paymentIntent.acquirer_routing?.selected_route
  if (selectedRoute?.adapter) {
    console.log(
      `[Routing Strategy] Using pre-selected route: ${selectedRoute.adapter}`
    )
    return {
      adapter: selectedRoute.adapter,
      merchantRef: selectedRoute.merchant_ref,
      config: selectedRoute.config,
    }
  }

  // STEP 2: Use merchant's configured strategy
  const strategy = merchantConfig?.strategy || 'default'

  switch (strategy) {
    case 'default':
      return pickDefaultRoute(paymentIntent, merchantConfig, env)

    case 'rules':
      return pickRulesBasedRoute(paymentIntent, merchantConfig, env)

    case 'smart':
      return pickSmartRoute(paymentIntent, merchantConfig, env)

    default:
      console.warn(
        `[Routing Strategy] Unknown strategy: ${strategy}, falling back to default`
      )
      return pickDefaultRoute(paymentIntent, merchantConfig, env)
  }
}

// ============================================================================
// STRATEGY IMPLEMENTATIONS
// ============================================================================

/**
 * DEFAULT STRATEGY
 *
 * Simple routing logic:
 * 1. Use merchantConfig.defaultAdapter if configured
 * 2. Use env.DEFAULT_ADAPTER if set
 * 3. Fallback to 'mock' for testing
 *
 * @param paymentIntent - Payment intent
 * @param merchantConfig - Merchant configuration
 * @param env - Environment variables
 * @returns RouteSelection
 */
function pickDefaultRoute(
  paymentIntent: PaymentIntent,
  merchantConfig: MerchantRoutingConfig | null,
  env: { DEFAULT_ADAPTER?: string }
): RouteSelection {
  // Try merchant's default adapter first
  const merchantDefaultAdapter = merchantConfig?.defaultAdapter
  if (merchantDefaultAdapter) {
    const adapterConfig = merchantConfig?.adapters?.[merchantDefaultAdapter]

    if (adapterConfig?.enabled) {
      console.log(
        `[Routing Strategy] Using merchant default adapter: ${merchantDefaultAdapter}`
      )
      return {
        adapter: merchantDefaultAdapter,
        merchantRef: adapterConfig.merchantRef,
        config: adapterConfig.config,
      }
    }
  }

  // Try environment default adapter
  const envDefaultAdapter = env.DEFAULT_ADAPTER
  if (envDefaultAdapter) {
    console.log(
      `[Routing Strategy] Using environment default adapter: ${envDefaultAdapter}`
    )
    return {
      adapter: envDefaultAdapter,
    }
  }

  // Fallback to mock for testing
  console.log(
    `[Routing Strategy] No default adapter configured, falling back to 'mock'`
  )
  return {
    adapter: 'mock',
  }
}

/**
 * RULES-BASED STRATEGY (SKELETON)
 *
 * TODO: Implement rules-based routing
 *
 * Logic to implement:
 * 1. Iterate through merchantConfig.rules in order
 * 2. Evaluate conditions against payment intent:
 *    - amount range (min/max)
 *    - currency match
 *    - card brand/type
 *    - billing country
 *    - 3DS requirement
 * 3. Return first matching rule's action.adapter
 * 4. Fallback to default if no rules match
 *
 * EXAMPLE RULE:
 * ```typescript
 * {
 *   id: 'rule_1',
 *   name: 'Route high-value USD to Adyen',
 *   enabled: true,
 *   conditions: {
 *     amount: { min: 100000 }, // $1000+
 *     currency: ['USD'],
 *     cardBrand: ['visa', 'mastercard']
 *   },
 *   action: {
 *     adapter: 'adyen',
 *     merchantRef: 'DeonPayCOM'
 *   }
 * }
 * ```
 *
 * @param paymentIntent - Payment intent
 * @param merchantConfig - Merchant configuration
 * @param env - Environment variables
 * @returns RouteSelection
 */
function pickRulesBasedRoute(
  paymentIntent: PaymentIntent,
  merchantConfig: MerchantRoutingConfig | null,
  env: { DEFAULT_ADAPTER?: string }
): RouteSelection {
  console.log(
    `[Routing Strategy] Rules-based routing not yet implemented, falling back to default`
  )

  // TODO: Implement rules evaluation
  // const rules = merchantConfig?.rules || []
  // for (const rule of rules) {
  //   if (!rule.enabled) continue
  //
  //   // Check amount range
  //   if (rule.conditions.amount) {
  //     const { min, max } = rule.conditions.amount
  //     if (min && paymentIntent.amount < min) continue
  //     if (max && paymentIntent.amount > max) continue
  //   }
  //
  //   // Check currency
  //   if (rule.conditions.currency?.length) {
  //     if (!rule.conditions.currency.includes(paymentIntent.currency)) continue
  //   }
  //
  //   // ... more conditions ...
  //
  //   // Rule matched!
  //   return {
  //     adapter: rule.action.adapter,
  //     merchantRef: rule.action.merchantRef,
  //     config: rule.action.config
  //   }
  // }

  // No rules matched, fallback to default
  return pickDefaultRoute(paymentIntent, merchantConfig, env)
}

/**
 * SMART ROUTING STRATEGY (SKELETON)
 *
 * TODO: Implement ML-based smart routing
 *
 * Logic to implement:
 * 1. Extract features from payment intent:
 *    - Amount, currency, card BIN
 *    - Time of day, day of week
 *    - Customer history (if available)
 *    - Merchant's historical performance per adapter
 * 2. Call ML model API or use local model to predict:
 *    - Approval probability per adapter
 *    - Expected cost per adapter
 *    - Expected latency per adapter
 * 3. Apply weights from merchantConfig.smartConfig.weights
 * 4. Select adapter with highest composite score
 * 5. Fallback to default if model unavailable
 *
 * EXAMPLE IMPLEMENTATION APPROACH:
 * ```typescript
 * // Fetch historical performance data
 * const stats = await fetchAdapterStats(paymentIntent.merchant_id)
 *
 * // Calculate composite score for each adapter
 * const scores = merchantConfig.adapters.map(adapter => ({
 *   adapter: adapter.name,
 *   score:
 *     (stats[adapter].approvalRate * weights.approvalRate) +
 *     (1 - stats[adapter].avgCost * weights.costOptimization) +
 *     (1 - stats[adapter].avgLatency * weights.latency)
 * }))
 *
 * // Pick highest scoring adapter
 * return scores.sort((a, b) => b.score - a.score)[0]
 * ```
 *
 * @param paymentIntent - Payment intent
 * @param merchantConfig - Merchant configuration
 * @param env - Environment variables
 * @returns RouteSelection
 */
function pickSmartRoute(
  paymentIntent: PaymentIntent,
  merchantConfig: MerchantRoutingConfig | null,
  env: { DEFAULT_ADAPTER?: string }
): RouteSelection {
  console.log(
    `[Routing Strategy] Smart routing not yet implemented, falling back to default`
  )

  // TODO: Implement ML-based routing
  // const smartConfig = merchantConfig?.smartConfig
  // if (!smartConfig?.enabled) {
  //   return pickDefaultRoute(paymentIntent, merchantConfig, env)
  // }
  //
  // const features = extractFeatures(paymentIntent)
  // const predictions = await predictAdapterPerformance(features, merchantConfig.adapters)
  // const weights = smartConfig.weights || { approvalRate: 0.5, costOptimization: 0.3, latency: 0.2 }
  //
  // const bestAdapter = selectBestAdapter(predictions, weights)
  // return {
  //   adapter: bestAdapter.name,
  //   merchantRef: bestAdapter.merchantRef,
  //   config: bestAdapter.config
  // }

  // Fallback to default
  return pickDefaultRoute(paymentIntent, merchantConfig, env)
}

// ============================================================================
// HELPER FUNCTIONS (FUTURE)
// ============================================================================

/**
 * TODO: Extract ML features from payment intent
 */
// function extractFeatures(pi: PaymentIntent): Record<string, any> {
//   return {
//     amount: pi.amount,
//     currency: pi.currency,
//     hour: new Date().getHours(),
//     dayOfWeek: new Date().getDay(),
//     // ... more features
//   }
// }

/**
 * TODO: Fetch adapter performance stats from database
 */
// async function fetchAdapterStats(merchantId: string): Promise<any> {
//   // Query charges table grouped by acquirer_route
//   // Calculate: approval_rate, avg_amount, avg_latency, total_volume
// }

/**
 * TODO: Call ML model to predict adapter performance
 */
// async function predictAdapterPerformance(
//   features: Record<string, any>,
//   adapters: MerchantRoutingConfig['adapters']
// ): Promise<any> {
//   // Call ML API or use local model
//   // Return predictions for each adapter
// }

/**
 * TODO: Select best adapter based on predictions and weights
 */
// function selectBestAdapter(
//   predictions: any,
//   weights: SmartRoutingConfig['weights']
// ): RouteSelection {
//   // Calculate composite score
//   // Return adapter with highest score
// }
