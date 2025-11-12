# Cambios Necesarios para Pasar Datos Reales de Tarjeta

## Archivos a Modificar

### 1. `src/router/index.ts`

**Líneas 57-65** - Actualizar tipo `ConfirmPaymentIntentParams`:

```typescript
// ANTES:
export type ConfirmPaymentIntentParams = {
  supabase: SupabaseClient
  paymentIntentId: string
  merchantId: string
  requestId: string
  env: {
    DEFAULT_ADAPTER?: string
  }
}

// DESPUÉS:
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
```

**Línea 153** - Actualizar función `confirmPaymentIntent`:

```typescript
// ANTES:
export async function confirmPaymentIntent(
  params: ConfirmPaymentIntentParams
): Promise<ConfirmPaymentIntentResult> {
  const { supabase, paymentIntentId, merchantId, requestId, env } = params

// DESPUÉS:
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
```

**Línea 197** - Actualizar llamada a mapper:

```typescript
// ANTES:
const authorizeInput = mapPIToAuthorizeInput(paymentIntent, requestId, route)

// DESPUÉS:
const authorizeInput = mapPIToAuthorizeInput(
  paymentIntent,
  requestId,
  route,
  rawPaymentMethod,
  billingDetails
)
```

---

### 2. `src/router/mapper.ts`

**Líneas 45-50** - Actualizar función `mapPIToAuthorizeInput`:

```typescript
// ANTES:
export function mapPIToAuthorizeInput(
  paymentIntent: PaymentIntent,
  requestId: string,
  route: { adapter: string; merchantRef?: string; config?: Record<string, any> }
): CanonicalAuthorizeInput {

// DESPUÉS:
export function mapPIToAuthorizeInput(
  paymentIntent: PaymentIntent,
  requestId: string,
  route: { adapter: string; merchantRef?: string; config?: Record<string, any> },
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
```

**Líneas 60-75** - Actualizar construcción del `canonicalPaymentMethod`:

```typescript
// ANTES:
const canonicalPaymentMethod: CanonicalAuthorizeInput['paymentMethod'] = {
  type: 'card',
  network: mapCardBrandToNetwork(pm.brand),
  brand: pm.brand,
  last4: pm.last4,
  expMonth: pm.exp_month,
  expYear: pm.exp_year,
  tokenization: {
    type: 'none',
  },
}

// DESPUÉS:
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
  tokenization: {
    type: 'none',
  },
}
```

**Líneas 90-100** - Agregar customer con billing details:

```typescript
// Agregar DESPUÉS de la línea 89:

// Add customer info with billing details
if (paymentIntent.customer_id || billingDetails) {
  authorizeInput.customer = {
    id: paymentIntent.customer_id,
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
```

---

### 3. `src/router/adapters/types.ts`

**Líneas 17-62** - Actualizar `CanonicalAuthorizeInput`:

Agregar campos opcionales a `paymentMethod`:

```typescript
// Línea 25-36:
paymentMethod: {
  type: 'card'
  network?: string
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  cardNumber?: string  // ← AGREGAR
  cvv?: string         // ← AGREGAR
  tokenization?: {
    type: 'network_token' | 'vault' | 'none'
    tokenRef?: string
  }
}
```

Agregar campo `billingAddress` opcional:

```typescript
// Después de customer (línea 42), AGREGAR:

billingAddress?: {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}
```

---

### 4. `src/router/adapters/cybersource.ts`

**Líneas 178-198** - Actualizar construcción del request:

```typescript
// ANTES:
orderInformation: {
  amountDetails: {
    totalAmount: (input.amount / 100).toFixed(2),
    currency: input.currency.toUpperCase(),
  },
  billTo: {
    firstName: input.customer?.name?.split(' ')[0] || 'Test',
    lastName: input.customer?.name?.split(' ').slice(1).join(' ') || 'User',
    email: input.customer?.email || 'test@example.com',
    postalCode: '11000',
    country: 'MX',
  },
},
paymentInformation: {
  card: {
    number: '4111111111111111', // For testing
    expirationMonth: input.paymentMethod.expMonth?.toString().padStart(2, '0') || '12',
    expirationYear: input.paymentMethod.expYear?.toString() || '2025',
    securityCode: '123', // For testing
  },
},

// DESPUÉS:
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
```

---

### 5. `src/routes/payment-intents.ts`

**Líneas 225-267** - Actualizar endpoint `/confirm`:

```typescript
// ANTES (línea 259):
const result = await confirmPaymentIntent({
  supabase,
  paymentIntentId: id,
  merchantId,
  requestId,
  env: {
    DEFAULT_ADAPTER: c.env.DEFAULT_ADAPTER || 'mock',
  },
})

// DESPUÉS:
const { payment_method: rawPaymentMethod, billing_details } = ConfirmPaymentIntentSchema.parse(body)

// Process raw card data to extract brand and last4 for DB storage
const processedPaymentMethod = processRawCardData(rawPaymentMethod)

// Update payment intent with processed payment method (for display purposes)
const { data: updatedPI, error: updateError } = await supabase
  .from('payment_intents')
  .update({ payment_method: processedPaymentMethod })
  .eq('id', id)
  .eq('merchant_id', merchantId)
  .select()
  .single()

if (updateError || !updatedPI) {
  return c.json({
    error: {
      type: 'invalid_request_error',
      message: 'Payment intent not found',
      code: 'resource_not_found',
    }
  }, 404)
}

// Pass raw payment method data to router (NOT stored in DB)
const result = await confirmPaymentIntent({
  supabase,
  paymentIntentId: id,
  merchantId,
  requestId,
  rawPaymentMethod,           // ← AGREGAR
  billingDetails: billing_details,  // ← AGREGAR
  env: {
    DEFAULT_ADAPTER: c.env.DEFAULT_ADAPTER || 'mock',
  },
})
```

---

## Orden de Aplicación

1. Actualizar `src/router/adapters/types.ts` (tipos base)
2. Actualizar `src/router/mapper.ts` (mapper)
3. Actualizar `src/router/index.ts` (router)
4. Actualizar `src/router/adapters/cybersource.ts` (adapter)
5. Actualizar `src/routes/payment-intents.ts` (endpoint)

## Verificación

Después de aplicar los cambios, verifica que:
- No haya errores de TypeScript: `npm run typecheck`
- El proyecto compile: `npm run build`
- Los logs muestren los datos correctos cuando se procesa un pago
