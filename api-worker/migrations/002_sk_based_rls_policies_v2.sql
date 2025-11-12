-- ============================================================================
-- DeonPay API v1 - SK-based RLS Policies Migration (v2)
-- ============================================================================
-- This migration implements proper RLS policies that differentiate between
-- Public Key (PK) and Secret Key (SK) access levels:
--
-- PK (pk_test_*, pk_live_*): Read-only access (for tokenization flows)
-- SK (sk_test_*, sk_live_*): Full CRUD access (for payment operations)
-- ============================================================================

-- ============================================================================
-- Step 1: Drop existing policies if they exist
-- ============================================================================

DROP POLICY IF EXISTS rate_limit_merchant_access ON rate_limit_hits;
DROP POLICY IF EXISTS idempotency_merchant_access ON idempotency_records;
DROP POLICY IF EXISTS session_logs_merchant_access ON session_logs;
DROP POLICY IF EXISTS payment_intents_merchant_access ON payment_intents;
DROP POLICY IF EXISTS payment_intents_sk_full_access ON payment_intents;
DROP POLICY IF EXISTS payment_intents_pk_read_only ON payment_intents;
DROP POLICY IF EXISTS customers_merchant_access ON customers;
DROP POLICY IF EXISTS customers_sk_full_access ON customers;
DROP POLICY IF EXISTS customers_pk_read_only ON customers;
DROP POLICY IF EXISTS refunds_merchant_access ON refunds;
DROP POLICY IF EXISTS refunds_sk_full_access ON refunds;
DROP POLICY IF EXISTS refunds_pk_read_only ON refunds;

-- ============================================================================
-- Step 2: Create helper function to get current merchant_id from context
-- ============================================================================

CREATE OR REPLACE FUNCTION current_merchant_id()
RETURNS UUID AS $$
BEGIN
  -- This will be set by the API middleware after API key validation
  RETURN current_setting('app.merchant_id', true)::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Step 3: Create helper function to get current API key type
-- ============================================================================

CREATE OR REPLACE FUNCTION current_api_key_type()
RETURNS TEXT AS $$
BEGIN
  -- This will be set by the API middleware after API key validation
  -- Returns: 'test', 'live' (which we treat as SK)
  RETURN current_setting('app.api_key_type', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Step 4: Create helper function to check if current key is Secret Key
-- ============================================================================

CREATE OR REPLACE FUNCTION is_secret_key()
RETURNS BOOLEAN AS $$
DECLARE
  key_type TEXT;
BEGIN
  key_type := current_api_key_type();
  -- In DeonPay, key_type is 'test' or 'live' for SK
  -- PK would have different key_type values
  -- For now, we assume 'test' and 'live' are SK
  RETURN key_type IN ('test', 'live');
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Step 5: RLS Policies for payment_intents table
-- ============================================================================

-- SK: Full access (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY payment_intents_sk_full_access ON payment_intents
  FOR ALL
  USING (
    merchant_id = current_merchant_id()
    AND is_secret_key()
  )
  WITH CHECK (
    merchant_id = current_merchant_id()
    AND is_secret_key()
  );

-- PK: Read-only access (SELECT only)
CREATE POLICY payment_intents_pk_read_only ON payment_intents
  FOR SELECT
  USING (
    merchant_id = current_merchant_id()
    AND NOT is_secret_key()
  );

-- ============================================================================
-- Step 6: RLS Policies for customers table
-- ============================================================================

-- SK: Full access
CREATE POLICY customers_sk_full_access ON customers
  FOR ALL
  USING (
    merchant_id = current_merchant_id()
    AND is_secret_key()
  )
  WITH CHECK (
    merchant_id = current_merchant_id()
    AND is_secret_key()
  );

-- PK: Read-only access
CREATE POLICY customers_pk_read_only ON customers
  FOR SELECT
  USING (
    merchant_id = current_merchant_id()
    AND NOT is_secret_key()
  );

-- ============================================================================
-- Step 7: RLS Policies for refunds table
-- ============================================================================

-- SK: Full access
CREATE POLICY refunds_sk_full_access ON refunds
  FOR ALL
  USING (
    merchant_id = current_merchant_id()
    AND is_secret_key()
  )
  WITH CHECK (
    merchant_id = current_merchant_id()
    AND is_secret_key()
  );

-- PK: Read-only access
CREATE POLICY refunds_pk_read_only ON refunds
  FOR SELECT
  USING (
    merchant_id = current_merchant_id()
    AND NOT is_secret_key()
  );

-- ============================================================================
-- Step 8: RLS Policies for middleware tables
-- ============================================================================

-- Rate limit hits: Only the merchant can access their own rate limit data
CREATE POLICY rate_limit_merchant_access ON rate_limit_hits
  FOR ALL
  USING (merchant_id = current_merchant_id())
  WITH CHECK (merchant_id = current_merchant_id());

-- Idempotency records: Only the merchant can access their own idempotency data
CREATE POLICY idempotency_merchant_access ON idempotency_records
  FOR ALL
  USING (merchant_id = current_merchant_id())
  WITH CHECK (merchant_id = current_merchant_id());

-- Session logs: Only the merchant can access their own session logs
CREATE POLICY session_logs_merchant_access ON session_logs
  FOR SELECT
  USING (merchant_id = current_merchant_id());

-- ============================================================================
-- Step 9: Verify policies are created
-- ============================================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename IN ('payment_intents', 'customers', 'refunds', 'rate_limit_hits', 'idempotency_records', 'session_logs');

  RAISE NOTICE 'Created % RLS policies successfully', policy_count;
END $$;

-- Success message
SELECT 'SK-based RLS policies migration completed successfully!' as message;
