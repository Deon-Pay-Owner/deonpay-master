# Migration Guide - DeonPay API

## Table of Contents
1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Authentication](#authentication)
4. [Payment Intents](#payment-intents)
5. [Customers](#customers)
6. [Products & Prices](#products--prices)
7. [Payment Links](#payment-links)
8. [Webhooks](#webhooks)
9. [Error Handling](#error-handling)
10. [Testing](#testing)

## Overview

DeonPay API provides a Stripe-compatible payment processing interface with multi-acquirer support. This guide will help you migrate from:
- Stripe API
- Custom payment implementations
- Other payment processors

### Key Differences from Stripe
- Multi-acquirer routing (CyberSource, Mock, and more)
- Built on Cloudflare Workers for global low-latency
- Supabase-powered data layer
- Row-level security for multi-tenant isolation

## Quick Start

### Installation

```bash
npm install @deonpay/sdk
```

### Basic Setup

```typescript
import { DeonPay } from '@deonpay/sdk'

const deonpay = new DeonPay({
  apiKey: 'sk_test_...',
  version: '2025-01-01',
})
```

### Create Your First Payment

```typescript
// 1. Create a payment intent
const paymentIntent = await deonpay.paymentIntents.create({
  amount: 5000, // $50.00 in cents
  currency: 'mxn',
})

// 2. Confirm with payment method
const confirmed = await deonpay.paymentIntents.confirm(paymentIntent.id, {
  payment_method: {
    type: 'card',
    card: {
      number: '4242424242424242',
      exp_month: 12,
      exp_year: 2025,
      cvv: '123',
    },
  },
})

console.log(confirmed.status) // 'succeeded'
```

## Authentication

### API Keys

DeonPay uses two types of API keys:
- **Secret keys** (`sk_test_...` / `sk_live_...`): Server-side only
- **Public keys** (`pk_test_...` / `pk_live_...`): Client-side safe

### Migration from Stripe

**Before (Stripe):**
```typescript
const stripe = require('stripe')('sk_test_...')
```

**After (DeonPay):**
```typescript
import { DeonPay } from '@deonpay/sdk'

const deonpay = new DeonPay({
  apiKey: 'sk_test_...',
  version: '2025-01-01',
})
```

### Direct API Calls

```typescript
fetch('https://api.deonpay.workers.dev/payment-intents', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer sk_test_...',
    'Content-Type': 'application/json',
    'deonpay-version': '2025-01-01',
  },
  body: JSON.stringify({
    amount: 1000,
    currency: 'mxn',
  }),
})
```

## Payment Intents

### Creating Payment Intents

**Stripe:**
```javascript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2000,
  currency: 'usd',
  automatic_payment_methods: {
    enabled: true,
  },
})
```

**DeonPay:**
```typescript
const paymentIntent = await deonpay.paymentIntents.create({
  amount: 2000,
  currency: 'mxn',
  automatic_payment_methods: {
    enabled: true,
  },
})
```

### Confirming Payment Intents

**Stripe:**
```javascript
const confirmed = await stripe.paymentIntents.confirm(
  'pi_...',
  {
    payment_method: 'pm_card_visa',
  }
)
```

**DeonPay:**
```typescript
const confirmed = await deonpay.paymentIntents.confirm('pi_...', {
  payment_method: {
    type: 'card',
    card: {
      number: '4242424242424242',
      exp_month: 12,
      exp_year: 2025,
      cvv: '123',
    },
  },
})
```

### Retrieving Payment Intents

**Both APIs (identical):**
```typescript
const paymentIntent = await deonpay.paymentIntents.retrieve('pi_...')
```

### Listing Payment Intents

**Stripe:**
```javascript
const paymentIntents = await stripe.paymentIntents.list({
  limit: 10,
})
```

**DeonPay:**
```typescript
const paymentIntents = await deonpay.paymentIntents.list({
  limit: 10,
  starting_after: 'pi_...',
})
```

## Customers

### Creating Customers

**Stripe:**
```javascript
const customer = await stripe.customers.create({
  email: 'customer@example.com',
  name: 'John Doe',
  metadata: {
    order_id: '12345',
  },
})
```

**DeonPay (identical):**
```typescript
const customer = await deonpay.customers.create({
  email: 'customer@example.com',
  name: 'John Doe',
  metadata: {
    order_id: '12345',
  },
})
```

### Customer Stats (DeonPay Extension)

DeonPay provides additional customer statistics:

```typescript
const customer = await deonpay.customers.retrieve('cus_...')

console.log(customer.stats)
// {
//   total_spent: 15000,
//   payment_count: 5,
//   last_payment_at: '2025-01-15T10:30:00Z'
// }
```

## Products & Prices

### Creating Products

**Stripe:**
```javascript
const product = await stripe.products.create({
  name: 'Premium Plan',
  description: 'Premium subscription',
})
```

**DeonPay (identical):**
```typescript
const product = await deonpay.products.create({
  name: 'Premium Plan',
  description: 'Premium subscription',
})
```

## Payment Links

### Creating Payment Links

**Stripe:**
```javascript
const paymentLink = await stripe.paymentLinks.create({
  line_items: [
    {
      price: 'price_...',
      quantity: 1,
    },
  ],
})
```

**DeonPay (identical):**
```typescript
const paymentLink = await deonpay.paymentLinks.create({
  line_items: [
    {
      price: 'price_...',
      quantity: 1,
    },
  ],
})
```

### DeonPay Custom URLs

Payment links in DeonPay are hosted at:
```
https://link.deonpay.mx/{link_id}
```

## Webhooks

### Webhook Signatures

**Stripe:**
```javascript
const stripe = require('stripe')('sk_...')

app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature']
  const event = stripe.webhooks.constructEvent(
    req.body,
    sig,
    'whsec_...'
  )
})
```

**DeonPay:**
```typescript
import crypto from 'crypto'

app.post('/webhook', async (req, res) => {
  const signature = req.headers['deonpay-signature']
  const payload = JSON.stringify(req.body)

  const hmac = crypto.createHmac('sha256', 'whsec_...')
  const digest = hmac.update(payload).digest('hex')

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    return res.status(401).send('Invalid signature')
  }

  // Process event
  const event = req.body
})
```

### Webhook Events

DeonPay supports the following events:
- `payment_intent.created`
- `payment_intent.succeeded`
- `payment_intent.failed`
- `payment_intent.canceled`
- `customer.created`
- `customer.updated`
- `refund.created`
- `refund.updated`

## Error Handling

### Error Response Format

**Stripe:**
```json
{
  "error": {
    "type": "card_error",
    "code": "card_declined",
    "message": "Your card was declined."
  }
}
```

**DeonPay (identical format):**
```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "amount_invalid",
    "message": "Amount must be a positive integer"
  }
}
```

### Error Handling in Code

```typescript
try {
  const paymentIntent = await deonpay.paymentIntents.create({
    amount: -100, // Invalid
    currency: 'mxn',
  })
} catch (error) {
  if (error.type === 'invalid_request_error') {
    console.error('Invalid request:', error.message)
  }
}
```

## Testing

### Test Cards

Use these test card numbers in sandbox mode:

| Card Number | Brand | Result |
|-------------|-------|--------|
| 4242424242424242 | Visa | Success |
| 5555555555554444 | Mastercard | Success |
| 378282246310005 | Amex | Success |
| 4000000000000002 | Visa | Decline |

### Test API Keys

```
Secret: sk_test_123456789
Public: pk_test_123456789
```

### Example Test

```typescript
import { describe, it, expect } from 'vitest'
import { DeonPay } from '@deonpay/sdk'

describe('Payment Flow', () => {
  const deonpay = new DeonPay({
    apiKey: 'sk_test_123456789',
  })

  it('should create and confirm payment', async () => {
    const intent = await deonpay.paymentIntents.create({
      amount: 1000,
      currency: 'mxn',
    })

    expect(intent.status).toBe('requires_payment_method')

    const confirmed = await deonpay.paymentIntents.confirm(intent.id, {
      payment_method: {
        type: 'card',
        card: {
          number: '4242424242424242',
          exp_month: 12,
          exp_year: 2025,
          cvv: '123',
        },
      },
    })

    expect(confirmed.status).toBe('succeeded')
  })
})
```

## Advanced Features

### Multi-Acquirer Routing

DeonPay automatically routes payments through the optimal acquirer:

```typescript
const paymentIntent = await deonpay.paymentIntents.create({
  amount: 5000,
  currency: 'mxn',
  metadata: {
    preferred_acquirer: 'cybersource', // Optional
  },
})
```

### Idempotency

Prevent duplicate requests:

```typescript
const paymentIntent = await deonpay.paymentIntents.create(
  {
    amount: 1000,
    currency: 'mxn',
  },
  {
    idempotencyKey: 'unique-key-123',
  }
)
```

### Rate Limiting

DeonPay enforces rate limits:
- Default: 100 requests per minute
- Headers returned:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`

## Migration Checklist

- [ ] Update API keys to DeonPay format
- [ ] Replace authentication headers
- [ ] Update payment intent creation flow
- [ ] Update webhook signature verification
- [ ] Test payment flows in sandbox
- [ ] Update error handling
- [ ] Configure webhook endpoints
- [ ] Test idempotency keys
- [ ] Verify rate limit handling
- [ ] Deploy to production

## Support

Need help migrating? Contact us:
- Documentation: https://docs.deonpay.mx
- Email: support@deonpay.mx
- GitHub: https://github.com/deonpay/api/issues
