-- Migration: Create API Keys table
-- Version: 012
-- Date: 2025-11-08
-- Description: Create table to store merchant API keys (public and secret)

-- ============================================================================
-- CREATE API KEYS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Key identification
  name TEXT NOT NULL DEFAULT 'Default Key',
  key_type TEXT NOT NULL CHECK (key_type IN ('test', 'live')),

  -- Public key (safe to expose in client-side code)
  public_key TEXT NOT NULL UNIQUE,

  -- Secret key (hashed, never exposed directly)
  secret_key_hash TEXT NOT NULL,
  secret_key_prefix TEXT NOT NULL, -- First 8 chars for display (e.g., "sk_test_abc...")

  -- Key metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Ensure only one set of keys per merchant per environment
  UNIQUE(merchant_id, key_type, is_active)
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_api_keys_merchant_id ON api_keys(merchant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_public_key ON api_keys(public_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- ============================================================================
-- CREATE UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_updated_at();

-- ============================================================================
-- DISABLE RLS (for now, since we're using anon key)
-- ============================================================================

ALTER TABLE api_keys DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE api_keys IS 'Stores merchant API keys for authentication';
COMMENT ON COLUMN api_keys.public_key IS 'Public key starting with pk_test_ or pk_live_';
COMMENT ON COLUMN api_keys.secret_key_hash IS 'Hashed secret key (bcrypt)';
COMMENT ON COLUMN api_keys.secret_key_prefix IS 'First 8 chars of secret key for display';
COMMENT ON COLUMN api_keys.key_type IS 'Environment: test or live';
