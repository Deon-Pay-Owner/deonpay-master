# DeonPay API v1.0 - Release Notes

## Version 1.0.0 - Initial Release
**Release Date:** 2025-01-20

### Overview
DeonPay API v1.0 introduces a modern, Stripe-compatible payment processing API built on Cloudflare Workers with multi-acquirer support.

## What's New

### Core Features
- **Multi-Acquirer Support**: Seamlessly route payments through multiple payment processors
  - CyberSource adapter (production-ready)
  - Mock adapter (testing)
  - Extensible adapter architecture

### API Endpoints
- **Payment Intents**: `/payment-intents`
  - Create, retrieve, confirm, and cancel payment intents
  - Stripe-compatible interface
  - Automatic payment method detection

- **Customers**: `/customers`
  - Customer management with stats
  - Payment method storage
  - Transaction history

- **Products**: `/products`
  - Product catalog management
  - Pricing and metadata support

- **Payment Links**: `/payment-links`
  - Shareable payment links
  - Custom branding
  - URL-based payments

- **Refunds**: `/refunds`
  - Full and partial refunds
  - Automated refund processing

- **Balance**: `/balance`
  - Real-time balance tracking
  - Multi-currency support

### Security Features
- **API Key Authentication**: Bearer token authentication with hashed storage
- **Rate Limiting**: Configurable per-endpoint rate limits
- **Idempotency**: Request deduplication via Idempotency-Key header
- **CORS Protection**: Configurable allowed origins
- **Row Level Security**: Database-level access control

### Infrastructure
- **Cloudflare Workers**: Edge computing for global low-latency
- **Supabase**: PostgreSQL database with real-time capabilities
- **TypeScript**: Full type safety across the stack
- **Zod Validation**: Runtime type validation

### Developer Experience
- **OpenAPI 3.1 Spec**: Complete API documentation
- **Test Coverage**: 159+ unit and integration tests
- **CI/CD**: Automated testing via GitHub Actions
- **Type-Safe SDKs**: TypeScript SDK available

## Migration Guide

### From Beta to v1.0

#### Breaking Changes
1. **Authentication**
   - Old: `x-api-key` header
   - New: `Authorization: Bearer <your-api-key>` header

2. **Payment Intent Status**
   - Removed: `pending` status
   - Added: `requires_payment_method` status

3. **Error Format**
   - Now follows Stripe error format:
   ```json
   {
     "error": {
       "type": "invalid_request_error",
       "message": "Amount must be a positive integer",
       "code": "amount_invalid"
     }
   }
   ```

4. **Webhook Signatures**
   - Now using HMAC-SHA256 for webhook signatures
   - Header changed from `x-webhook-signature` to `deonpay-signature`

#### New Requirements
- **API Version Header**: Include `deonpay-version: 2025-01-01` header
- **Merchant ID**: Required in all authenticated requests

### From Custom Implementation

If you're migrating from a custom payment integration:

1. **Update Authentication**
   ```typescript
   // Before
   headers: {
     'x-api-key': 'your-key'
   }

   // After
   headers: {
     'Authorization': 'Bearer sk_test_...',
     'deonpay-version': '2025-01-01'
   }
   ```

2. **Update Payment Flow**
   ```typescript
   // Create payment intent
   const intent = await fetch('https://api.deonpay.workers.dev/payment-intents', {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer sk_test_...',
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({
       amount: 1000,
       currency: 'mxn',
     }),
   })

   // Confirm with payment method
   const confirmed = await fetch(`https://api.deonpay.workers.dev/payment-intents/${intent.id}/confirm`, {
     method: 'POST',
     headers: {
       'Authorization': 'Bearer sk_test_...',
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({
       payment_method: {
         type: 'card',
         card: {
           number: '4242424242424242',
           exp_month: 12,
           exp_year: 2025,
           cvv: '123',
         },
       },
     }),
   })
   ```

3. **Handle Webhooks**
   ```typescript
   import crypto from 'crypto'

   function verifyWebhook(payload: string, signature: string, secret: string) {
     const hmac = crypto.createHmac('sha256', secret)
     const digest = hmac.update(payload).digest('hex')
     return crypto.timingSafeEqual(
       Buffer.from(signature),
       Buffer.from(digest)
     )
   }
   ```

## Known Issues
- Rate limiting resets are per-deployment, not global
- Webhook retries limited to 3 attempts
- Payment Links do not support subscription products yet

## Deprecation Notices
None for v1.0 initial release.

## Upgrade Path
1. Update API keys to use new format (sk_test_* or sk_live_*)
2. Update authentication headers
3. Test payment flows in sandbox environment
4. Update webhook verification logic
5. Deploy to production

## Support
- Documentation: https://docs.deonpay.mx
- API Reference: https://docs.deonpay.mx/api
- GitHub Issues: https://github.com/deonpay/api/issues
- Email: support@deonpay.mx

## Changelog

### Added
- Complete payment processing API
- Multi-acquirer routing
- Stripe-compatible interface
- Customer management
- Product catalog
- Payment links
- Refund processing
- OpenAPI specification
- Comprehensive test suite
- CI/CD pipeline

### Changed
- N/A (initial release)

### Deprecated
- N/A (initial release)

### Removed
- N/A (initial release)

### Fixed
- N/A (initial release)

### Security
- API key hashing with SHA-256
- Rate limiting on all endpoints
- Idempotency key support
- CORS protection
- Row-level security in database
