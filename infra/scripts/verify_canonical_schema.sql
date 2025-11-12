-- ============================================================================
-- Verification Script: Canonical Data Schema
-- Description: Verifies all tables, columns, indexes, and RLS policies exist
-- Usage: Run in Supabase SQL Editor or via psql
-- ============================================================================

DO $$
DECLARE
  v_result TEXT;
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'CANONICAL DATA SCHEMA VERIFICATION';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- 1. VERIFY TABLES EXIST
-- ============================================================================

SELECT
  'Tables Created' AS verification_type,
  CASE
    WHEN COUNT(*) = 6 THEN '✓ PASS'
    ELSE '✗ FAIL - Expected 6 tables, found ' || COUNT(*)::TEXT
  END AS status,
  array_agg(table_name ORDER BY table_name) AS tables_found
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'customers',
    'payment_intents',
    'charges',
    'refunds',
    'balance_transactions',
    'webhook_deliveries'
  );

-- ============================================================================
-- 2. VERIFY CUSTOMERS TABLE
-- ============================================================================

SELECT
  'customers - columns' AS verification_type,
  CASE
    WHEN COUNT(*) >= 7 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing columns'
  END AS status,
  COUNT(*)::TEXT || ' columns found' AS detail
FROM information_schema.columns
WHERE table_name = 'customers'
  AND column_name IN ('id', 'merchant_id', 'email', 'name', 'phone', 'metadata', 'created_at', 'updated_at');

SELECT
  'customers - indexes' AS verification_type,
  CASE
    WHEN COUNT(*) >= 2 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing indexes'
  END AS status,
  array_agg(indexname) AS indexes_found
FROM pg_indexes
WHERE tablename = 'customers'
  AND indexname LIKE 'idx_customers%';

SELECT
  'customers - RLS' AS verification_type,
  CASE
    WHEN COUNT(*) >= 4 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing RLS policies'
  END AS status,
  COUNT(*)::TEXT || ' policies found' AS detail
FROM pg_policies
WHERE tablename = 'customers';

-- ============================================================================
-- 3. VERIFY PAYMENT_INTENTS TABLE
-- ============================================================================

SELECT
  'payment_intents - columns' AS verification_type,
  CASE
    WHEN COUNT(*) >= 12 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing columns'
  END AS status,
  COUNT(*)::TEXT || ' columns found' AS detail
FROM information_schema.columns
WHERE table_name = 'payment_intents'
  AND column_name IN (
    'id', 'merchant_id', 'customer_id', 'amount', 'currency',
    'capture_method', 'confirmation_method', 'status', 'payment_method',
    'acquirer_routing', 'metadata', 'created_at', 'updated_at'
  );

SELECT
  'payment_intents - indexes' AS verification_type,
  CASE
    WHEN COUNT(*) >= 4 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing indexes'
  END AS status,
  array_agg(indexname) AS indexes_found
FROM pg_indexes
WHERE tablename = 'payment_intents'
  AND indexname LIKE 'idx_pi%';

SELECT
  'payment_intents - RLS' AS verification_type,
  CASE
    WHEN COUNT(*) >= 3 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing RLS policies'
  END AS status,
  COUNT(*)::TEXT || ' policies found' AS detail
FROM pg_policies
WHERE tablename = 'payment_intents';

-- ============================================================================
-- 4. VERIFY CHARGES TABLE
-- ============================================================================

SELECT
  'charges - columns' AS verification_type,
  CASE
    WHEN COUNT(*) >= 13 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing columns'
  END AS status,
  COUNT(*)::TEXT || ' columns found' AS detail
FROM information_schema.columns
WHERE table_name = 'charges'
  AND column_name IN (
    'id', 'merchant_id', 'payment_intent_id', 'amount_authorized',
    'amount_captured', 'amount_refunded', 'currency', 'status',
    'processor_response', 'acquirer_name', 'acquirer_reference',
    'authorization_code', 'network', 'metadata', 'created_at', 'updated_at'
  );

SELECT
  'charges - indexes' AS verification_type,
  CASE
    WHEN COUNT(*) >= 4 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing indexes'
  END AS status,
  array_agg(indexname) AS indexes_found
FROM pg_indexes
WHERE tablename = 'charges'
  AND indexname LIKE 'idx_charges%';

SELECT
  'charges - RLS' AS verification_type,
  CASE
    WHEN COUNT(*) >= 3 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing RLS policies'
  END AS status,
  COUNT(*)::TEXT || ' policies found' AS detail
FROM pg_policies
WHERE tablename = 'charges';

-- ============================================================================
-- 5. VERIFY REFUNDS TABLE
-- ============================================================================

SELECT
  'refunds - columns' AS verification_type,
  CASE
    WHEN COUNT(*) >= 9 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing columns'
  END AS status,
  COUNT(*)::TEXT || ' columns found' AS detail
FROM information_schema.columns
WHERE table_name = 'refunds'
  AND column_name IN (
    'id', 'merchant_id', 'charge_id', 'amount', 'currency',
    'reason', 'status', 'acquirer_reference', 'metadata',
    'created_at', 'updated_at'
  );

SELECT
  'refunds - indexes' AS verification_type,
  CASE
    WHEN COUNT(*) >= 3 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing indexes'
  END AS status,
  array_agg(indexname) AS indexes_found
FROM pg_indexes
WHERE tablename = 'refunds'
  AND indexname LIKE 'idx_refunds%';

SELECT
  'refunds - RLS' AS verification_type,
  CASE
    WHEN COUNT(*) >= 3 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing RLS policies'
  END AS status,
  COUNT(*)::TEXT || ' policies found' AS detail
FROM pg_policies
WHERE tablename = 'refunds';

-- ============================================================================
-- 6. VERIFY BALANCE_TRANSACTIONS TABLE
-- ============================================================================

SELECT
  'balance_transactions - columns' AS verification_type,
  CASE
    WHEN COUNT(*) >= 10 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing columns'
  END AS status,
  COUNT(*)::TEXT || ' columns found' AS detail
FROM information_schema.columns
WHERE table_name = 'balance_transactions'
  AND column_name IN (
    'id', 'merchant_id', 'type', 'source_id', 'source_type',
    'amount', 'fee', 'net', 'currency', 'metadata', 'created_at'
  );

SELECT
  'balance_transactions - indexes' AS verification_type,
  CASE
    WHEN COUNT(*) >= 3 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing indexes'
  END AS status,
  array_agg(indexname) AS indexes_found
FROM pg_indexes
WHERE tablename = 'balance_transactions'
  AND indexname LIKE 'idx_bt%';

SELECT
  'balance_transactions - RLS' AS verification_type,
  CASE
    WHEN COUNT(*) >= 2 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing RLS policies'
  END AS status,
  COUNT(*)::TEXT || ' policies found' AS detail
FROM pg_policies
WHERE tablename = 'balance_transactions';

-- ============================================================================
-- 7. VERIFY WEBHOOK_DELIVERIES TABLE
-- ============================================================================

SELECT
  'webhook_deliveries - columns' AS verification_type,
  CASE
    WHEN COUNT(*) >= 13 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing columns'
  END AS status,
  COUNT(*)::TEXT || ' columns found' AS detail
FROM information_schema.columns
WHERE table_name = 'webhook_deliveries'
  AND column_name IN (
    'id', 'merchant_id', 'event_type', 'event_id', 'endpoint_url',
    'payload', 'attempt', 'max_attempts', 'status_code', 'response_body',
    'error', 'next_retry_at', 'delivered', 'delivered_at', 'created_at'
  );

SELECT
  'webhook_deliveries - indexes' AS verification_type,
  CASE
    WHEN COUNT(*) >= 3 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing indexes'
  END AS status,
  array_agg(indexname) AS indexes_found
FROM pg_indexes
WHERE tablename = 'webhook_deliveries'
  AND indexname LIKE 'idx_webhook_deliveries%';

SELECT
  'webhook_deliveries - RLS' AS verification_type,
  CASE
    WHEN COUNT(*) >= 2 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing RLS policies'
  END AS status,
  COUNT(*)::TEXT || ' policies found' AS detail
FROM pg_policies
WHERE tablename = 'webhook_deliveries';

-- ============================================================================
-- 8. VERIFY TRIGGERS
-- ============================================================================

SELECT
  'Triggers - updated_at' AS verification_type,
  CASE
    WHEN COUNT(*) >= 4 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing triggers'
  END AS status,
  array_agg(trigger_name) AS triggers_found
FROM information_schema.triggers
WHERE event_object_table IN ('customers', 'payment_intents', 'charges', 'refunds')
  AND trigger_name LIKE '%updated_at%';

SELECT
  'Triggers - balance_transactions' AS verification_type,
  CASE
    WHEN COUNT(*) >= 2 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing triggers'
  END AS status,
  array_agg(trigger_name) AS triggers_found
FROM information_schema.triggers
WHERE event_object_table IN ('charges', 'refunds')
  AND trigger_name LIKE '%balance_transaction%';

-- ============================================================================
-- 9. VERIFY FOREIGN KEY CONSTRAINTS
-- ============================================================================

SELECT
  'Foreign Keys' AS verification_type,
  CASE
    WHEN COUNT(*) >= 8 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing foreign keys'
  END AS status,
  COUNT(*)::TEXT || ' constraints found' AS detail
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.table_name IN (
    'customers',
    'payment_intents',
    'charges',
    'refunds',
    'balance_transactions',
    'webhook_deliveries'
  )
  AND kcu.column_name LIKE '%merchant_id%' OR kcu.column_name LIKE '%customer_id%' OR kcu.column_name LIKE '%payment_intent_id%' OR kcu.column_name LIKE '%charge_id%';

-- ============================================================================
-- 10. VERIFY CHECK CONSTRAINTS
-- ============================================================================

SELECT
  'Check Constraints' AS verification_type,
  CASE
    WHEN COUNT(*) >= 5 THEN '✓ PASS'
    ELSE '✗ FAIL - Missing check constraints'
  END AS status,
  COUNT(*)::TEXT || ' constraints found' AS detail
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%payment_intents%'
   OR constraint_name LIKE '%charges%'
   OR constraint_name LIKE '%refunds%'
   OR constraint_name LIKE '%balance_transactions%';

-- ============================================================================
-- 11. SUMMARY - COUNT RECORDS (if any)
-- ============================================================================

SELECT
  'Data Check - customers' AS table_name,
  COUNT(*)::TEXT || ' records' AS record_count
FROM customers;

SELECT
  'Data Check - payment_intents' AS table_name,
  COUNT(*)::TEXT || ' records' AS record_count
FROM payment_intents;

SELECT
  'Data Check - charges' AS table_name,
  COUNT(*)::TEXT || ' records' AS record_count
FROM charges;

SELECT
  'Data Check - refunds' AS table_name,
  COUNT(*)::TEXT || ' records' AS record_count
FROM refunds;

SELECT
  'Data Check - balance_transactions' AS table_name,
  COUNT(*)::TEXT || ' records' AS record_count
FROM balance_transactions;

SELECT
  'Data Check - webhook_deliveries' AS table_name,
  COUNT(*)::TEXT || ' records' AS record_count
FROM webhook_deliveries;

-- ============================================================================
-- VERIFICATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'VERIFICATION COMPLETE';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Review results above. All checks should show ✓ PASS';
  RAISE NOTICE '';
END $$;
