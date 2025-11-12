-- ============================================================================
-- Migration: Canonical Data Schema for Multi-Acquirer Payments (MVP)
-- Version: 020
-- Date: 2025-11-09
-- Description: Creates core payment processing tables following canonical data model
-- ============================================================================
--
-- DEPENDENCIES:
--   - merchants table (from 001_onboarding_min.sql)
--   - update_updated_at_column() function (from 001_onboarding_min.sql)
--
-- COMPATIBILITY NOTES:
--   - Uses existing merchant_id pattern (not company_id)
--   - Follows existing RLS pattern: merchant_id IN (SELECT id FROM merchants WHERE owner_user_id = auth.uid())
--   - Money stored as BIGINT (minor units/centavos)
--   - All migrations are idempotent (safe to re-run)
--
-- TABLES CREATED:
--   1. customers - Customer/buyer records scoped to merchant
--   2. payment_intents - Top-level payment orchestration objects
--   3. charges - Individual charge attempts (tied to payment_intent)
--   4. refunds - Refund records (tied to charges)
--   5. balance_transactions - Ledger for merchant balance movements
--   6. webhook_deliveries - Observability log for webhook deliveries per merchant
-- ============================================================================

-- ============================================================================
-- 1. CUSTOMERS TABLE
-- ============================================================================
-- Stores customer/buyer information scoped to merchant
-- Used for payment tracking, recurring billing, and customer management
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Customer identity
  email VARCHAR(255),
  name VARCHAR(255),
  phone VARCHAR(50),

  -- Additional data
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_merchant ON customers(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(merchant_id, email) WHERE email IS NOT NULL;

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view their own customers" ON customers;
CREATE POLICY "Merchants can view their own customers" ON customers
  FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Merchants can create their own customers" ON customers;
CREATE POLICY "Merchants can create their own customers" ON customers
  FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Merchants can update their own customers" ON customers;
CREATE POLICY "Merchants can update their own customers" ON customers
  FOR UPDATE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Merchants can delete their own customers" ON customers;
CREATE POLICY "Merchants can delete their own customers" ON customers
  FOR DELETE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

-- ============================================================================
-- 2. PAYMENT_INTENTS TABLE
-- ============================================================================
-- Top-level payment orchestration object
-- Tracks the lifecycle of a payment from creation to completion
-- Supports multi-acquirer routing and automatic/manual capture
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Amount & currency (amount in minor units - centavos)
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'MXN',

  -- Payment flow control
  capture_method TEXT NOT NULL DEFAULT 'automatic' CHECK (capture_method IN ('automatic', 'manual')),
  confirmation_method TEXT NOT NULL DEFAULT 'automatic' CHECK (confirmation_method IN ('automatic', 'manual')),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'requires_payment_method' CHECK (
    status IN (
      'requires_payment_method',  -- Initial state, waiting for PM
      'requires_action',           -- Needs customer action (3DS, etc)
      'processing',                -- Being processed
      'succeeded',                 -- Payment completed
      'canceled',                  -- Canceled before completion
      'failed'                     -- Failed to process
    )
  ),

  -- Payment method data (canonical representation)
  -- Example: {"brand": "visa", "last4": "4242", "exp_month": 12, "exp_year": 2025, "token_ref": "tok_..."}
  payment_method JSONB,

  -- Acquirer routing information
  -- Example: {"selected": "stripe", "candidates": ["stripe", "conekta"], "routing_strategy": "cost_optimization"}
  acquirer_routing JSONB,

  -- Additional data
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pi_merchant ON payment_intents(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pi_customer ON payment_intents(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pi_status ON payment_intents(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_pi_created ON payment_intents(created_at DESC);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_pi_updated_at ON payment_intents;
CREATE TRIGGER trg_pi_updated_at
  BEFORE UPDATE ON payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view their own payment intents" ON payment_intents;
CREATE POLICY "Merchants can view their own payment intents" ON payment_intents
  FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Merchants can create their own payment intents" ON payment_intents;
CREATE POLICY "Merchants can create their own payment intents" ON payment_intents
  FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Merchants can update their own payment intents" ON payment_intents;
CREATE POLICY "Merchants can update their own payment intents" ON payment_intents
  FOR UPDATE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

-- ============================================================================
-- 3. CHARGES TABLE
-- ============================================================================
-- Individual charge attempts against a payment intent
-- Tracks authorization, capture, and refund amounts
-- Stores processor responses and acquirer references
-- ============================================================================

CREATE TABLE IF NOT EXISTS charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,

  -- Amounts (in minor units - centavos)
  amount_authorized BIGINT NOT NULL CHECK (amount_authorized > 0),
  amount_captured BIGINT NOT NULL DEFAULT 0 CHECK (amount_captured >= 0),
  amount_refunded BIGINT NOT NULL DEFAULT 0 CHECK (amount_refunded >= 0),

  -- Currency
  currency CHAR(3) NOT NULL DEFAULT 'MXN',

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'authorized' CHECK (
    status IN (
      'authorized',          -- Card authorized but not captured
      'captured',            -- Funds captured
      'partially_refunded',  -- Some funds refunded
      'refunded',            -- Fully refunded
      'voided',              -- Authorization voided
      'failed'               -- Charge failed
    )
  ),

  -- Processor response details
  -- Example: {"code": "00", "message": "Approved", "avs_result": "Y", "cvc_check": "pass"}
  processor_response JSONB,

  -- Acquirer data
  acquirer_name TEXT,                    -- e.g., "stripe", "conekta"
  acquirer_reference TEXT,               -- Processor's charge ID
  authorization_code TEXT,               -- Auth code from card network
  network TEXT,                          -- e.g., "visa", "mastercard"

  -- Additional data
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_charges_pi ON charges(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_charges_merchant ON charges(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_charges_status ON charges(merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_charges_acquirer_ref ON charges(acquirer_reference) WHERE acquirer_reference IS NOT NULL;

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_charges_updated_at ON charges;
CREATE TRIGGER trg_charges_updated_at
  BEFORE UPDATE ON charges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view their own charges" ON charges;
CREATE POLICY "Merchants can view their own charges" ON charges
  FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Merchants can create their own charges" ON charges;
CREATE POLICY "Merchants can create their own charges" ON charges
  FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Merchants can update their own charges" ON charges;
CREATE POLICY "Merchants can update their own charges" ON charges
  FOR UPDATE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

-- ============================================================================
-- 4. REFUNDS TABLE
-- ============================================================================
-- Refund records tied to charges
-- Tracks full and partial refunds with acquirer references
-- ============================================================================

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  charge_id UUID NOT NULL REFERENCES charges(id) ON DELETE CASCADE,

  -- Amount (in minor units - centavos)
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'MXN',

  -- Refund details
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',    -- Refund initiated
      'succeeded',  -- Refund completed
      'failed'      -- Refund failed
    )
  ),

  -- Acquirer data
  acquirer_reference TEXT,  -- Processor's refund ID

  -- Additional data
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_refunds_charge ON refunds(charge_id);
CREATE INDEX IF NOT EXISTS idx_refunds_merchant ON refunds(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(merchant_id, status);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_refunds_updated_at ON refunds;
CREATE TRIGGER trg_refunds_updated_at
  BEFORE UPDATE ON refunds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view their own refunds" ON refunds;
CREATE POLICY "Merchants can view their own refunds" ON refunds
  FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Merchants can create their own refunds" ON refunds;
CREATE POLICY "Merchants can create their own refunds" ON refunds
  FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Merchants can update their own refunds" ON refunds;
CREATE POLICY "Merchants can update their own refunds" ON refunds
  FOR UPDATE
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

-- ============================================================================
-- 5. BALANCE_TRANSACTIONS TABLE
-- ============================================================================
-- Ledger of all balance movements for merchant accounts
-- Tracks charges, refunds, fees, adjustments, and payouts
-- Provides visible balance history for reconciliation
-- ============================================================================

CREATE TABLE IF NOT EXISTS balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Transaction type
  type TEXT NOT NULL CHECK (
    type IN (
      'charge',       -- Payment received
      'refund',       -- Refund issued
      'fee',          -- Platform/processing fee
      'adjustment',   -- Manual adjustment
      'payout'        -- Payout to merchant bank account
    )
  ),

  -- Source reference (charge_id, refund_id, etc.)
  source_id UUID,
  source_type TEXT,  -- e.g., "charge", "refund", "payout"

  -- Amounts (in minor units - centavos)
  amount BIGINT NOT NULL,           -- Gross amount
  fee BIGINT NOT NULL DEFAULT 0,    -- Fee charged
  net BIGINT NOT NULL,              -- Net amount (amount - fee)
  currency CHAR(3) NOT NULL DEFAULT 'MXN',

  -- Additional data
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bt_merchant_created ON balance_transactions(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bt_type ON balance_transactions(merchant_id, type);
CREATE INDEX IF NOT EXISTS idx_bt_source ON balance_transactions(source_id) WHERE source_id IS NOT NULL;

-- RLS
ALTER TABLE balance_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view their own balance transactions" ON balance_transactions;
CREATE POLICY "Merchants can view their own balance transactions" ON balance_transactions
  FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Merchants can create their own balance transactions" ON balance_transactions;
CREATE POLICY "Merchants can create their own balance transactions" ON balance_transactions
  FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

-- ============================================================================
-- 6. WEBHOOK_DELIVERIES TABLE
-- ============================================================================
-- Observability log for webhook delivery attempts
-- Tracks all webhook deliveries per merchant for debugging and monitoring
-- Separate from webhook_events (which is per webhook_id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL,           -- e.g., "payment.succeeded", "refund.created"
  event_id UUID,                      -- Reference to payment_intent, charge, etc.

  -- Delivery details
  endpoint_url TEXT NOT NULL,
  payload JSONB NOT NULL,

  -- Attempt tracking
  attempt INT NOT NULL DEFAULT 1,
  max_attempts INT NOT NULL DEFAULT 3,

  -- Response details
  status_code INT,                    -- HTTP status code (200, 404, 500, etc.)
  response_body TEXT,
  error TEXT,

  -- Retry tracking
  next_retry_at TIMESTAMPTZ,
  delivered BOOLEAN NOT NULL DEFAULT false,
  delivered_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_merchant ON webhook_deliveries(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered ON webhook_deliveries(delivered, next_retry_at) WHERE NOT delivered;

-- RLS
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view their own webhook deliveries" ON webhook_deliveries;
CREATE POLICY "Merchants can view their own webhook deliveries" ON webhook_deliveries
  FOR SELECT
  USING (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Merchants can create their own webhook deliveries" ON webhook_deliveries;
CREATE POLICY "Merchants can create their own webhook deliveries" ON webhook_deliveries
  FOR INSERT
  WITH CHECK (merchant_id IN (
    SELECT id FROM merchants WHERE owner_user_id = auth.uid()
  ));

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create a balance transaction when a charge is captured
CREATE OR REPLACE FUNCTION create_balance_transaction_for_charge()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create balance transaction when status changes to 'captured'
  IF NEW.status = 'captured' AND OLD.status != 'captured' THEN
    INSERT INTO balance_transactions (
      merchant_id,
      type,
      source_id,
      source_type,
      amount,
      fee,
      net,
      currency,
      description
    ) VALUES (
      NEW.merchant_id,
      'charge',
      NEW.id,
      'charge',
      NEW.amount_captured,
      0,  -- Fee calculation would go here
      NEW.amount_captured,
      NEW.currency,
      'Charge captured'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create balance transactions
DROP TRIGGER IF EXISTS trg_charge_balance_transaction ON charges;
CREATE TRIGGER trg_charge_balance_transaction
  AFTER UPDATE ON charges
  FOR EACH ROW
  EXECUTE FUNCTION create_balance_transaction_for_charge();

-- Function to create a balance transaction when a refund succeeds
CREATE OR REPLACE FUNCTION create_balance_transaction_for_refund()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create balance transaction when status changes to 'succeeded'
  IF NEW.status = 'succeeded' AND (OLD.status IS NULL OR OLD.status != 'succeeded') THEN
    INSERT INTO balance_transactions (
      merchant_id,
      type,
      source_id,
      source_type,
      amount,
      fee,
      net,
      currency,
      description
    ) VALUES (
      NEW.merchant_id,
      'refund',
      NEW.id,
      'refund',
      -NEW.amount,  -- Negative because it's money out
      0,
      -NEW.amount,
      NEW.currency,
      'Refund processed'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create balance transactions for refunds
DROP TRIGGER IF EXISTS trg_refund_balance_transaction ON refunds;
CREATE TRIGGER trg_refund_balance_transaction
  AFTER INSERT OR UPDATE ON refunds
  FOR EACH ROW
  EXECUTE FUNCTION create_balance_transaction_for_refund();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE customers IS 'Customer/buyer records scoped to merchant';
COMMENT ON TABLE payment_intents IS 'Top-level payment orchestration objects';
COMMENT ON TABLE charges IS 'Individual charge attempts against payment intents';
COMMENT ON TABLE refunds IS 'Refund records tied to charges';
COMMENT ON TABLE balance_transactions IS 'Ledger of all balance movements';
COMMENT ON TABLE webhook_deliveries IS 'Observability log for webhook deliveries';

COMMENT ON COLUMN payment_intents.amount IS 'Amount in minor units (centavos for MXN)';
COMMENT ON COLUMN payment_intents.capture_method IS 'automatic: capture immediately, manual: capture later';
COMMENT ON COLUMN payment_intents.payment_method IS 'Canonical payment method: {brand, last4, exp_month, exp_year, token_ref}';
COMMENT ON COLUMN payment_intents.acquirer_routing IS 'Routing info: {selected, candidates, routing_strategy}';

COMMENT ON COLUMN charges.amount_authorized IS 'Amount authorized (may differ from captured)';
COMMENT ON COLUMN charges.amount_captured IS 'Amount actually captured (in minor units)';
COMMENT ON COLUMN charges.amount_refunded IS 'Total amount refunded from this charge';
COMMENT ON COLUMN charges.processor_response IS 'Raw processor response: {code, message, avs_result, cvc_check}';

COMMENT ON COLUMN balance_transactions.amount IS 'Gross amount (positive for credits, negative for debits)';
COMMENT ON COLUMN balance_transactions.fee IS 'Fee charged by platform/processor';
COMMENT ON COLUMN balance_transactions.net IS 'Net amount (amount - fee)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- To apply this migration:
-- 1. Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- 2. Or use psql: psql -f 020_canonical_data_schema.sql
-- 3. Verify with: \dt to list tables, \d table_name for details
--
-- After migration:
-- - Run verification script: scripts/verify_canonical_schema.sql
-- - Check RLS policies are active: SELECT * FROM pg_policies WHERE tablename IN ('customers', 'payment_intents', 'charges', 'refunds', 'balance_transactions', 'webhook_deliveries');
-- ============================================================================
