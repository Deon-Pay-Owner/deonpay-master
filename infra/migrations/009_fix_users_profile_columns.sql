-- Migration: Add missing columns to users_profile
-- Version: 009
-- Date: 2025-11-08
-- Description: Ensure all required columns exist in users_profile table

-- ============================================================================
-- CHECK AND ADD MISSING COLUMNS TO users_profile
-- ============================================================================

-- Add full_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users_profile'
      AND column_name = 'full_name'
  ) THEN
    ALTER TABLE users_profile ADD COLUMN full_name TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added full_name column';
  ELSE
    RAISE NOTICE 'full_name column already exists';
  END IF;
END $$;

-- Add phone column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users_profile'
      AND column_name = 'phone'
  ) THEN
    ALTER TABLE users_profile ADD COLUMN phone TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added phone column';
  ELSE
    RAISE NOTICE 'phone column already exists';
  END IF;
END $$;

-- Add profile_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users_profile'
      AND column_name = 'profile_type'
  ) THEN
    ALTER TABLE users_profile ADD COLUMN profile_type TEXT NOT NULL DEFAULT 'merchant_owner';
    RAISE NOTICE 'Added profile_type column';
  ELSE
    RAISE NOTICE 'profile_type column already exists';
  END IF;
END $$;

-- Verify all columns exist
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users_profile'
ORDER BY ordinal_position;

-- ============================================================================
-- VERIFY RLS IS DISABLED
-- ============================================================================
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'users_profile';
