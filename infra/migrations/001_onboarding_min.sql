-- Migration: Enhanced onboarding with profile, merchant and contact data
-- Version: 001
-- Date: 2025-11-07
-- Description: Creates/updates tables for user profiles, merchants, and member relationships

-- ============================================================================
-- 1. MERCHANTS TABLE
-- ============================================================================
-- Stores merchant/business information with MX/CNP defaults
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'MX',
  currency TEXT NOT NULL DEFAULT 'MXN',
  channel TEXT NOT NULL DEFAULT 'CARD_NOT_PRESENT',
  status TEXT NOT NULL DEFAULT 'draft',
  onboarding_stage TEXT NOT NULL DEFAULT 'initial',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_merchants_owner ON merchants(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);

-- ============================================================================
-- 2. USERS_PROFILE TABLE
-- ============================================================================
-- Stores user profile data and contact information
CREATE TABLE IF NOT EXISTS users_profile (
  user_id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('merchant_owner', 'developer', 'agency')),
  default_merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for merchant lookup
CREATE INDEX IF NOT EXISTS idx_users_profile_merchant ON users_profile(default_merchant_id);

-- ============================================================================
-- 3. MERCHANT_MEMBERS TABLE
-- ============================================================================
-- Relationship table for merchant access control
CREATE TABLE IF NOT EXISTS merchant_members (
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (merchant_id, user_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_merchant_members_user ON merchant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_members_merchant ON merchant_members(merchant_id);

-- ============================================================================
-- 4. ADD MISSING COLUMNS TO EXISTING TABLES (IDEMPOTENT)
-- ============================================================================
-- If tables already exist, add missing columns safely

-- Merchants: add updated_at if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'merchants' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE merchants ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Users_profile: add updated_at if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users_profile' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE users_profile ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS on all tables
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_members ENABLE ROW LEVEL SECURITY;

-- Merchants: users can read/update their own merchants or where they're members
DROP POLICY IF EXISTS "Users can view their merchants" ON merchants;
CREATE POLICY "Users can view their merchants" ON merchants
  FOR SELECT
  USING (
    auth.uid() = owner_user_id
    OR
    EXISTS (
      SELECT 1 FROM merchant_members
      WHERE merchant_members.merchant_id = merchants.id
      AND merchant_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own merchants" ON merchants;
CREATE POLICY "Users can insert their own merchants" ON merchants
  FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Users can update their merchants" ON merchants;
CREATE POLICY "Users can update their merchants" ON merchants
  FOR UPDATE
  USING (
    auth.uid() = owner_user_id
    OR
    EXISTS (
      SELECT 1 FROM merchant_members
      WHERE merchant_members.merchant_id = merchants.id
      AND merchant_members.user_id = auth.uid()
      AND merchant_members.role IN ('owner', 'admin')
    )
  );

-- Users_profile: users can only access their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON users_profile;
CREATE POLICY "Users can view their own profile" ON users_profile
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON users_profile;
CREATE POLICY "Users can insert their own profile" ON users_profile
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON users_profile;
CREATE POLICY "Users can update their own profile" ON users_profile
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Merchant_members: users can view memberships for their merchants
DROP POLICY IF EXISTS "Users can view merchant members" ON merchant_members;
CREATE POLICY "Users can view merchant members" ON merchant_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = merchant_members.merchant_id
      AND merchants.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can manage members" ON merchant_members;
CREATE POLICY "Owners can manage members" ON merchant_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = merchant_members.merchant_id
      AND merchants.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. TRIGGERS FOR UPDATED_AT
-- ============================================================================
-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to merchants
DROP TRIGGER IF EXISTS update_merchants_updated_at ON merchants;
CREATE TRIGGER update_merchants_updated_at
  BEFORE UPDATE ON merchants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to users_profile
DROP TRIGGER IF EXISTS update_users_profile_updated_at ON users_profile;
CREATE TRIGGER update_users_profile_updated_at
  BEFORE UPDATE ON users_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- To apply this migration:
-- 1. Copy this SQL file
-- 2. Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- 3. Or use Supabase CLI: supabase db push
