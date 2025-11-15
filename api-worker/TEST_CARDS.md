# Test Card Numbers

This document provides test card numbers for testing DeonPay integrations in sandbox/test environments.

## CyberSource Test Cards

### 3DS Testing

For testing 3D Secure (3DS) authentication flows with CyberSource:

**3DS Challenge Required:**
- Card Number: `5200828282828210`
- This card will trigger a 3DS challenge flow requiring user authentication
- Use any future expiration date (e.g., 12/2025)
- Use any 3-digit CVV (e.g., 123)

**3DS Frictionless (No Challenge):**
- Card Number: `4000020000000000`
- This card will complete 3DS authentication without requiring a challenge
- Use any future expiration date (e.g., 12/2025)
- Use any 3-digit CVV (e.g., 123)

**Regular Successful Payment (No 3DS):**
- Card Number: `4111111111111111`
- Standard test card that will authorize successfully without 3DS
- Use any future expiration date (e.g., 12/2025)
- Use any 3-digit CVV (e.g., 123)

### Fraud Review Testing

**Triggers Fraud Review:**
- Card Number: `4000000000001091`
- This card will trigger CyberSource's Decision Manager for fraud review
- Response status will be `AUTHORIZED_PENDING_REVIEW` or `PENDING_REVIEW`
- The payment will be authorized but flagged for manual review

### Declined Cards

**Generic Decline:**
- Card Number: `4000000000000002`
- This card will be declined by the processor

**Insufficient Funds:**
- Card Number: `4000000000009995`
- This card will be declined with an insufficient funds error

**Invalid CVV:**
- Card Number: `4000000000000127`
- Use CVV `999` to trigger a CVV mismatch decline

## Testing Workflows

### Testing 3DS Challenge Flow

1. Use card `5200828282828210`
2. Create a payment intent
3. Confirm the payment intent
4. You should receive a `requires_action` status with a redirect URL
5. Complete the 3DS challenge (in test mode, you can skip this)
6. The payment should complete successfully

### Testing Fraud Review

1. Use card `4000000000001091`
2. Create and confirm a payment intent
3. The payment will authorize but with status `AUTHORIZED_PENDING_REVIEW`
4. The payment intent status will be `processing` or `requires_review`
5. The charge status will be `pending_review`

### Testing Declined Payments

1. Use card `4000000000000002`
2. Create and confirm a payment intent
3. The payment will be declined
4. The payment intent status will be `requires_payment_method`

## Important Notes

- **Test Environment Only:** These card numbers only work in the CyberSource sandbox/test environment
- **Expiration Date:** Use any valid future date (e.g., 12/2025, 01/2026)
- **CVV:** Use any 3-digit code (e.g., 123) unless testing CVV validation specifically
- **Billing Address:** Use a valid US postal code (e.g., 94043) or the country's format you're testing

## Additional Resources

- [CyberSource Test Card Numbers](https://developer.cybersource.com/hello-world/testing-guide/test-card-numbers.html)
- [CyberSource Testing Guide](https://developer.cybersource.com/hello-world/testing-guide.html)
- [3DS Testing Documentation](https://developer.cybersource.com/docs/cybs/en-us/digital-accept-flex/developer/all/rest/digital-accept-flex/pa-flex-intro.html)

## Updating the Playground

When testing in the DeonPay playground, use these card numbers instead of randomly generated ones to ensure consistent and predictable test results.
