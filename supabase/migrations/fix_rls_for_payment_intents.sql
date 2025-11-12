-- ============================================================================
-- Fix RLS Policies for Payment Intents
-- ============================================================================
-- This migration ensures RLS policies are properly configured for the API
-- ============================================================================

-- Step 1: Create the set_merchant_context function if it doesn't exist
CREATE OR REPLACE FUNCTION set_merchant_context(
  p_merchant_id UUID,
  p_key_type TEXT
)
RETURNS void AS $$
BEGIN
  -- Set merchant_id in session config
  PERFORM set_config('app.merchant_id', p_merchant_id::TEXT, false);

  -- Set key_type in session config
  PERFORM set_config('app.api_key_type', p_key_type, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (used by Supabase client)
GRANT EXECUTE ON FUNCTION set_merchant_context(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION set_merchant_context(UUID, TEXT) TO authenticated;

-- Step 2: Create helper functions for RLS
CREATE OR REPLACE FUNCTION current_merchant_id()
RETURNS UUID AS $$
BEGIN
  RETURN current_setting('app.merchant_id', true)::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION current_api_key_type()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.api_key_type', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION is_secret_key()
RETURNS BOOLEAN AS $$
DECLARE
  key_type TEXT;
BEGIN
  key_type := current_api_key_type();
  -- In DeonPay, key_type is 'test' or 'live' for SK
  RETURN key_type IN ('test', 'live');
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 3: Drop existing policies
DROP POLICY IF EXISTS payment_intents_sk_full_access ON payment_intents;
DROP POLICY IF EXISTS payment_intents_pk_read_only ON payment_intents;
DROP POLICY IF EXISTS customers_sk_full_access ON customers;
DROP POLICY IF EXISTS customers_pk_read_only ON customers;
DROP POLICY IF EXISTS charges_sk_full_access ON charges;
DROP POLICY IF EXISTS charges_pk_read_only ON charges;
DROP POLICY IF EXISTS refunds_sk_full_access ON refunds;
DROP POLICY IF EXISTS refunds_pk_read_only ON refunds;

-- Step 4: Enable RLS on tables
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for payment_intents
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

CREATE POLICY payment_intents_pk_read_only ON payment_intents
  FOR SELECT
  USING (
    merchant_id = current_merchant_id()
    AND NOT is_secret_key()
  );

-- Step 6: Create RLS policies for customers
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

CREATE POLICY customers_pk_read_only ON customers
  FOR SELECT
  USING (
    merchant_id = current_merchant_id()
    AND NOT is_secret_key()
  );

-- Step 7: Create RLS policies for charges
CREATE POLICY charges_sk_full_access ON charges
  FOR ALL
  USING (
    merchant_id = current_merchant_id()
    AND is_secret_key()
  )
  WITH CHECK (
    merchant_id = current_merchant_id()
    AND is_secret_key()
  );

CREATE POLICY charges_pk_read_only ON charges
  FOR SELECT
  USING (
    merchant_id = current_merchant_id()
    AND NOT is_secret_key()
  );

-- Step 8: Create RLS policies for refunds
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

CREATE POLICY refunds_pk_read_only ON refunds
  FOR SELECT
  USING (
    merchant_id = current_merchant_id()
    AND NOT is_secret_key()
  );

-- Success message
SELECT 'RLS policies fixed successfully!' as message;
