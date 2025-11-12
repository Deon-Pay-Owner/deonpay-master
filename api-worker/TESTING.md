# DeonPay API v1 - Testing Guide

## Prerequisites

1. **Database Setup**: Run the migration first
```bash
# Apply the migration to your Supabase database
# Use Supabase Dashboard > SQL Editor
# Copy/paste the contents of migrations/001_api_v1_middleware_tables.sql
```

2. **Environment Variables**: Ensure these are set
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
ENVIRONMENT=development
RATE_LIMIT_MAX=60
RATE_LIMIT_WINDOW_MS=60000
IDEMPOTENCY_TTL_SECONDS=86400
```

3. **Get a Test API Key**
```sql
-- Create a test merchant and API key in Supabase
INSERT INTO merchants (id, business_name, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test Merchant', 'test@example.com');

INSERT INTO api_keys (merchant_id, public_key, key_type, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'pk_test_1234567890abcdef',
  'test',
  true
);
```

## Starting the Dev Server

```bash
cd api-worker
npm install
npm run dev
# Server should start at http://localhost:8787
```

## Test 1: Health Check

```bash
curl http://localhost:8787/
```

Expected: 200 OK with service info

## Test 2: Request ID Middleware

```bash
# Without X-Request-ID (generates one)
curl -i http://localhost:8787/

# With custom X-Request-ID
curl -i -H "X-Request-ID: req_custom_12345" http://localhost:8787/
```

Check response headers for `X-Request-ID`

## Test 3: Authentication

```bash
# Without auth (should fail)
curl -X GET http://localhost:8787/api/v1/payment_intents

# With valid API key
curl -X GET http://localhost:8787/api/v1/payment_intents \
  -H "Authorization: Bearer pk_test_1234567890abcdef"
```

## Test 4: Rate Limiting

```bash
# Send 61 requests (limit is 60/min)
for i in {1..61}; do
  curl -s http://localhost:8787/api/v1/payment_intents \
    -H "Authorization: Bearer pk_test_1234567890abcdef" &
done
wait
```

Request #61 should return 429 rate_limited

## Test 5: Idempotency - Happy Path

```bash
# First request
curl -X POST http://localhost:8787/api/v1/payment_intents \
  -H "Authorization: Bearer pk_test_1234567890abcdef" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-001" \
  -d '{"amount": 10000, "currency": "MXN"}'

# Second request (same key, same body)
curl -X POST http://localhost:8787/api/v1/payment_intents \
  -H "Authorization: Bearer pk_test_1234567890abcdef" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-001" \
  -d '{"amount": 10000, "currency": "MXN"}'
```

Second response should have `Idempotency-Replayed: true` header

## Test 6: Idempotency Conflict

```bash
# First request
curl -X POST http://localhost:8787/api/v1/payment_intents \
  -H "Authorization: Bearer pk_test_1234567890abcdef" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: conflict-001" \
  -d '{"amount": 10000, "currency": "MXN"}'

# Second request (same key, DIFFERENT body)
curl -X POST http://localhost:8787/api/v1/payment_intents \
  -H "Authorization: Bearer pk_test_1234567890abcdef" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: conflict-001" \
  -d '{"amount": 20000, "currency": "MXN"}'
```

Should return 409 Conflict

## Test 7: Request Logging

```bash
# Make a request
curl -X GET http://localhost:8787/api/v1/payment_intents \
  -H "Authorization: Bearer pk_test_1234567890abcdef"

# Check session_logs table
SELECT * FROM session_logs ORDER BY created_at DESC LIMIT 10;
```

## Test 8: All Middlewares Together

```bash
curl -i -X POST http://localhost:8787/api/v1/payment_intents \
  -H "Authorization: Bearer pk_test_1234567890abcdef" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: full-test" \
  -H "X-Request-ID: req_custom_001" \
  -d '{"amount": 50000, "currency": "MXN"}'
```

Verify headers:
- X-Request-ID: req_custom_001
- X-RateLimit-Limit: 60
- X-RateLimit-Remaining: (count)
- X-RateLimit-Reset: (timestamp)

## Expected Results Summary

| Test | Expected Result |
|------|----------------|
| Health Check | 200 OK |
| Request ID | X-Request-ID header |
| No Auth | 401 error |
| Valid Auth | 200 OK |
| Rate Limit | 429 after 60 requests |
| Idempotency Replay | Same response + header |
| Idempotency Conflict | 409 error |
| Logging | Entries in session_logs |

## Troubleshooting

### "Supabase configuration missing"
Check SUPABASE_URL and SUPABASE_ANON_KEY

### "Invalid or inactive API key"
Verify api_keys table has the key with is_active=true

### Rate limiting not working
Check rate_limit_hits table exists

### Idempotency not working
Check idempotency_records table exists

### Logs not appearing
Check session_logs table and console for errors
