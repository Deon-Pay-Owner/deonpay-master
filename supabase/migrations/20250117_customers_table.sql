-- Customers Table for DeonPay
-- This migration creates the customers table to track merchant customers

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Customer information
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,

  -- Billing address
  billing_address JSONB DEFAULT '{}'::jsonb, -- {line1, line2, city, state, postal_code, country}

  -- Shipping address
  shipping_address JSONB DEFAULT '{}'::jsonb,

  -- Payment methods (references to saved payment methods)
  default_payment_method_id UUID REFERENCES payment_methods(id),

  -- Customer metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  description TEXT,

  -- Tax information
  tax_exempt BOOLEAN DEFAULT false,
  tax_ids JSONB DEFAULT '[]'::jsonb, -- Array of tax ID objects

  -- Customer preferences
  preferred_locales TEXT[] DEFAULT '{}',
  currency TEXT CHECK (LENGTH(currency) = 3),

  -- Balance (for credits/debits)
  balance INTEGER DEFAULT 0, -- In minor units

  -- Aggregated stats (denormalized for performance)
  total_spent INTEGER DEFAULT 0, -- Total amount spent in minor units
  transaction_count INTEGER DEFAULT 0, -- Total number of completed transactions
  last_transaction_at TIMESTAMP WITH TIME ZONE,

  -- Status
  delinquent BOOLEAN DEFAULT false, -- Has unpaid invoices
  deleted BOOLEAN DEFAULT false, -- Soft delete flag

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique email per merchant
  CONSTRAINT unique_merchant_customer_email UNIQUE(merchant_id, email)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_customers_merchant_id ON customers(merchant_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_created_at ON customers(created_at);
CREATE INDEX idx_customers_last_transaction_at ON customers(last_transaction_at);
CREATE INDEX idx_customers_deleted ON customers(deleted);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Merchants can manage their customers
CREATE POLICY "Merchants can manage their customers"
  ON customers FOR ALL
  USING (merchant_id IN (
    SELECT merchant_id FROM merchant_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to find or create customer
CREATE OR REPLACE FUNCTION find_or_create_customer(
  p_merchant_id UUID,
  p_email TEXT,
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  -- Try to find existing customer by email
  SELECT id INTO v_customer_id
  FROM customers
  WHERE merchant_id = p_merchant_id
    AND email = p_email
    AND deleted = false
  LIMIT 1;

  -- If not found, create new customer
  IF v_customer_id IS NULL THEN
    INSERT INTO customers (merchant_id, email, name, phone, metadata)
    VALUES (p_merchant_id, p_email, p_name, p_phone, p_metadata)
    RETURNING id INTO v_customer_id;
  ELSE
    -- Update customer info if provided
    UPDATE customers
    SET
      name = COALESCE(p_name, name),
      phone = COALESCE(p_phone, phone),
      metadata = metadata || p_metadata,
      updated_at = NOW()
    WHERE id = v_customer_id;
  END IF;

  RETURN v_customer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update customer stats after a transaction
CREATE OR REPLACE FUNCTION update_customer_stats(
  p_customer_id UUID,
  p_amount INTEGER,
  p_transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS VOID AS $$
BEGIN
  UPDATE customers
  SET
    total_spent = total_spent + p_amount,
    transaction_count = transaction_count + 1,
    last_transaction_at = p_transaction_date,
    updated_at = NOW()
  WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Auto-create customer on checkout completion
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_create_customer_on_checkout()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id UUID;
  v_amount INTEGER;
BEGIN
  -- Only process when session is completed and has customer email
  IF NEW.status = 'complete' AND NEW.customer_email IS NOT NULL THEN

    -- Find or create customer
    v_customer_id := find_or_create_customer(
      p_merchant_id := NEW.merchant_id,
      p_email := NEW.customer_email,
      p_name := NEW.customer_name,
      p_phone := NEW.customer_phone
    );

    -- Update the checkout session with customer_id if not set
    IF NEW.customer_id IS NULL THEN
      NEW.customer_id := v_customer_id;
    END IF;

    -- Update customer stats if payment was made
    IF NEW.payment_status = 'paid' THEN
      v_amount := COALESCE(NEW.amount_total, 0);
      PERFORM update_customer_stats(v_customer_id, v_amount, NEW.completed_at);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_customer
  BEFORE UPDATE ON checkout_sessions
  FOR EACH ROW
  WHEN (OLD.status != 'complete' AND NEW.status = 'complete')
  EXECUTE FUNCTION auto_create_customer_on_checkout();

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE customers IS 'Customer records for merchants';
COMMENT ON COLUMN customers.email IS 'Customer email address (unique per merchant)';
COMMENT ON COLUMN customers.total_spent IS 'Total amount spent by customer in minor units';
COMMENT ON COLUMN customers.transaction_count IS 'Total number of completed transactions';
COMMENT ON COLUMN customers.deleted IS 'Soft delete flag - archived customers';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant necessary permissions to service role
GRANT ALL ON customers TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
