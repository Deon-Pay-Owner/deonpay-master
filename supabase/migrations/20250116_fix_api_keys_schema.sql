-- Fix API Keys Schema to match API Worker expectations
-- This migration updates the api_keys table to use the correct schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- DROP OLD TABLE AND RECREATE WITH CORRECT SCHEMA
-- ============================================================================

-- Drop existing table and triggers
DROP TRIGGER IF EXISTS trigger_create_default_api_keys ON merchants;
DROP FUNCTION IF EXISTS create_default_api_keys();
DROP FUNCTION IF EXISTS generate_api_key(UUID, TEXT, TEXT);
DROP TABLE IF EXISTS api_keys CASCADE;

-- Create api_keys table with correct schema matching API worker
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Key information
  name TEXT,
  key_type TEXT NOT NULL CHECK (key_type IN ('public', 'secret')),

  -- For public keys: store in plain text
  public_key TEXT,

  -- For secret keys: store only the hash (never store raw secret keys)
  secret_key_hash TEXT,
  secret_key_prefix TEXT, -- First 12 chars for display (e.g., "sk_live_abc...")

  -- Status and usage
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_merchant_id ON api_keys(merchant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_public_key ON api_keys(public_key) WHERE is_active = true AND public_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_secret_hash ON api_keys(secret_key_hash) WHERE is_active = true AND secret_key_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_type ON api_keys(key_type);

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

-- Function to hash secret keys using SHA-256
CREATE OR REPLACE FUNCTION hash_secret_key(p_secret_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN encode(digest(p_secret_key, 'sha256'), 'hex');
END;
$$;

-- Function to generate a random string for API keys
CREATE OR REPLACE FUNCTION generate_random_string(p_length INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_random TEXT;
BEGIN
  -- Generate random bytes and encode as base64
  v_random := encode(gen_random_bytes(p_length), 'base64');
  -- Remove characters that aren't URL-safe
  v_random := replace(replace(replace(v_random, '+', ''), '/', ''), '=', '');
  -- Truncate to desired length
  v_random := substring(v_random, 1, p_length);
  RETURN v_random;
END;
$$;

-- Function to generate API keys (returns the full key for one-time display)
CREATE OR REPLACE FUNCTION generate_api_keys(
  p_merchant_id UUID,
  p_key_type TEXT,
  p_name TEXT DEFAULT NULL
)
RETURNS TABLE(key TEXT, prefix TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key TEXT;
  v_prefix TEXT;
  v_random TEXT;
  v_hash TEXT;
BEGIN
  -- Generate prefix based on type
  v_prefix := CASE
    WHEN p_key_type = 'public' THEN 'pk_live_'
    WHEN p_key_type = 'secret' THEN 'sk_live_'
    ELSE 'key_'
  END;

  -- Generate random string (32 characters)
  v_random := generate_random_string(32);

  -- Combine prefix and random string
  v_key := v_prefix || v_random;

  -- For public keys, store the key directly
  IF p_key_type = 'public' THEN
    INSERT INTO api_keys (
      merchant_id,
      name,
      key_type,
      public_key,
      is_active
    ) VALUES (
      p_merchant_id,
      COALESCE(p_name, 'Public Key'),
      p_key_type,
      v_key,
      true
    );
  -- For secret keys, store only the hash
  ELSE
    v_hash := hash_secret_key(v_key);
    INSERT INTO api_keys (
      merchant_id,
      name,
      key_type,
      secret_key_hash,
      secret_key_prefix,
      is_active
    ) VALUES (
      p_merchant_id,
      COALESCE(p_name, 'Secret Key'),
      p_key_type,
      v_hash,
      substring(v_key, 1, 12),
      true
    );
  END IF;

  -- Return the full key and prefix
  RETURN QUERY SELECT v_key, v_prefix;
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
  PERFORM generate_api_keys(NEW.id, 'public', 'Default Public Key');

  -- Create secret key
  PERFORM generate_api_keys(NEW.id, 'secret', 'Default Secret Key');

  RETURN NEW;
END;
$$;

-- Trigger to create API keys when merchant is created
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
  public_key_result RECORD;
  secret_key_result RECORD;
BEGIN
  FOR merchant_record IN
    SELECT m.id
    FROM merchants m
    LEFT JOIN api_keys ak ON ak.merchant_id = m.id
    WHERE ak.id IS NULL
    GROUP BY m.id
  LOOP
    -- Create public key
    SELECT * INTO public_key_result FROM generate_api_keys(merchant_record.id, 'public', 'Default Public Key');

    -- Create secret key
    SELECT * INTO secret_key_result FROM generate_api_keys(merchant_record.id, 'secret', 'Default Secret Key');

    RAISE NOTICE 'Created API keys for merchant %', merchant_record.id;
  END LOOP;
END $$;
