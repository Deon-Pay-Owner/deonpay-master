# Critical Issues Fixed

## Issue 1: Webhook Deliveries Column Name Mismatch ✅ FIXED

### Problem
The `webhook_deliveries` table in the database doesn't have a `webhook_id` column, but the code was trying to insert data with this column, causing the error:
```
"Could not find the 'webhook_id' column of 'webhook_deliveries' in the schema cache"
```

### Root Cause
The database schema (defined in `infra/migrations/020_canonical_data_schema.sql`) creates the `webhook_deliveries` table without a `webhook_id` column. Instead, it only has:
- `event_id` - Reference to the actual event (payment_intent, charge, etc.)
- `event_type` - Type of event being delivered

### Solution Applied
**File Modified:** `C:\Users\hecto\OneDrive\Documentos\deonpay-master\api-worker\src\router\events.ts`

**Change:** Removed the `webhook_id` field from the insert statement (line 213).

```typescript
// BEFORE:
const deliveries = subscribedWebhooks.map((webhook) => ({
  merchant_id: merchantId,
  webhook_id: webhook.id,  // ❌ This column doesn't exist
  event_type: eventType,
  // ...
}))

// AFTER:
const deliveries = subscribedWebhooks.map((webhook) => ({
  merchant_id: merchantId,
  // Note: webhook_deliveries table doesn't have webhook_id column, only event_id
  event_type: eventType,
  event_id: eventId,
  // ...
}))
```

## Issue 2: Missing API Keys for Merchant

### Problem
Merchant ID `030fba4e-3d47-4587-a323-59abd664c771` was created but no API keys were generated.

### Root Cause Analysis
1. **No automatic trigger:** There's no database trigger that automatically creates API keys when a merchant is created.
2. **Manual creation:** The merchant was likely created directly in Supabase dashboard or through a different flow that doesn't include the API key generation step.
3. **Normal signup flow:** The landing page signup (`apps/landing/app/api/signup/route.ts`) DOES generate API keys (lines 149-193), but this merchant wasn't created through that flow.

### Solutions Provided

#### Solution 1: SQL Script (Immediate Fix)
**File Created:** `C:\Users\hecto\OneDrive\Documentos\deonpay-master\scripts\generate-keys-for-merchant.sql`

Run this script directly in Supabase SQL editor:
1. Go to Supabase Dashboard > SQL Editor
2. Copy the contents of the script
3. Run it to generate both test and live API keys
4. **IMPORTANT:** Save the secret keys immediately - they cannot be recovered later!

#### Solution 2: TypeScript Script (For Development)
**File Created:** `C:\Users\hecto\OneDrive\Documentos\deonpay-master\scripts\generate-keys-for-merchant.ts`

Run from command line:
```bash
cd C:\Users\hecto\OneDrive\Documentos\deonpay-master
npx tsx scripts/generate-keys-for-merchant.ts 030fba4e-3d47-4587-a323-59abd664c771
```

## Deployment Instructions

### 1. Deploy API Worker with Webhook Fix
```bash
# Navigate to api-worker directory
cd C:\Users\hecto\OneDrive\Documentos\deonpay-master\api-worker

# Build and deploy
npm run build
npm run deploy
```

### 2. Generate API Keys for Affected Merchant
Use the SQL script in Supabase dashboard (fastest method):
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Paste and run the script from `scripts/generate-keys-for-merchant.sql`
4. Save the displayed keys immediately

### 3. Verify Webhooks Work
After deployment, test webhook delivery:
1. Create a test webhook for the merchant
2. Trigger an event (e.g., create a payment)
3. Check the `webhook_deliveries` table - no more column errors should occur

## Prevention Recommendations

### For API Keys Issue
1. **Add validation:** Check for API keys existence after merchant creation
2. **Add logging:** Log when merchants are created without going through the signup flow
3. **Consider a trigger:** Add a database function that generates default test keys when a merchant is created without keys

### For Webhook Deliveries Issue
1. **Schema validation:** Add TypeScript types that match the database schema exactly
2. **Testing:** Add integration tests that verify webhook delivery inserts work correctly
3. **Documentation:** Document the actual database schema for `webhook_deliveries` table

## Files Modified/Created

### Modified Files
- `api-worker/src/router/events.ts` - Fixed webhook_deliveries insert

### Created Files
- `scripts/generate-keys-for-merchant.sql` - SQL script for immediate key generation
- `scripts/generate-keys-for-merchant.ts` - TypeScript utility for key generation
- `FIX_SUMMARY.md` - This documentation file

## Testing Checklist
- [ ] Deploy API worker with webhook fix
- [ ] Run SQL script to generate API keys for merchant `030fba4e-3d47-4587-a323-59abd664c771`
- [ ] Save the generated API keys securely
- [ ] Create a test webhook endpoint
- [ ] Trigger a payment event
- [ ] Verify webhook delivery is logged in `webhook_deliveries` table
- [ ] Verify no column name errors in logs