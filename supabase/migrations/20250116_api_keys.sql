-- API Keys Management System for DeonPay
-- This migration creates the api_keys table for managing merchant API keys

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- API KEYS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Key information
  key TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('public', 'secret')),
  name TEXT, -- Optional name/label for the key

  -- Status
  active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Security
  key_prefix TEXT, -- First few characters for identification (e.g., "sk_live_abc...")

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration

  -- Indexes for performance
  CONSTRAINT unique_merchant_key UNIQUE(merchant_id, key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_merchant_id ON api_keys(merchant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_type ON api_keys(type);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Merchants can view their own API keys
CREATE POLICY "Merchants can view their own API keys"
  ON api_keys
  FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

-- Policy: Merchants can insert their own API keys
CREATE POLICY "Merchants can create their own API keys"
  ON api_keys
  FOR INSERT
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

-- Policy: Merchants can update their own API keys
CREATE POLICY "Merchants can update their own API keys"
  ON api_keys
  FOR UPDATE
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

-- Policy: Merchants can delete their own API keys
CREATE POLICY "Merchants can delete their own API keys"
  ON api_keys
  FOR DELETE
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to generate API key with proper prefix
CREATE OR REPLACE FUNCTION generate_api_key(
  p_merchant_id UUID,
  p_type TEXT,
  p_name TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key TEXT;
  v_prefix TEXT;
  v_random TEXT;
BEGIN
  -- Generate prefix based on type
  v_prefix := CASE
    WHEN p_type = 'public' THEN 'pk_live_'
    WHEN p_type = 'secret' THEN 'sk_live_'
    ELSE 'key_'
  END;

  -- Generate random string (32 characters)
  v_random := encode(gen_random_bytes(24), 'base64');
  v_random := replace(replace(replace(v_random, '+', ''), '/', ''), '=', '');
  v_random := substring(v_random, 1, 32);

  -- Combine prefix and random string
  v_key := v_prefix || v_random;

  -- Insert the new key
  INSERT INTO api_keys (merchant_id, key, type, name, key_prefix, active)
  VALUES (p_merchant_id, v_key, p_type, p_name, v_prefix, true);

  RETURN v_key;
END;
$$;

-- Function to automatically create API keys when a merchant is created
CREATE OR REPLACE FUNCTION create_default_api_keys()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create public key
  PERFORM generate_api_key(NEW.id, 'public', 'Default Public Key');

  -- Create secret key
  PERFORM generate_api_key(NEW.id, 'secret', 'Default Secret Key');

  RETURN NEW;
END;
$$;

-- Trigger to create API keys when merchant is created
DROP TRIGGER IF EXISTS trigger_create_default_api_keys ON merchants;
CREATE TRIGGER trigger_create_default_api_keys
  AFTER INSERT ON merchants
  FOR EACH ROW
  EXECUTE FUNCTION create_default_api_keys();

-- ============================================================================
-- BACKFILL EXISTING MERCHANTS
-- ============================================================================

-- Create API keys for existing merchants that don't have them
DO $$
DECLARE
  merchant_record RECORD;
BEGIN
  FOR merchant_record IN
    SELECT m.id
    FROM merchants m
    LEFT JOIN api_keys ak ON ak.merchant_id = m.id
    WHERE ak.id IS NULL
    GROUP BY m.id
  LOOP
    -- Create public key
    PERFORM generate_api_key(merchant_record.id, 'public', 'Default Public Key');

    -- Create secret key
    PERFORM generate_api_key(merchant_record.id, 'secret', 'Default Secret Key');
  END LOOP;
END $$;
