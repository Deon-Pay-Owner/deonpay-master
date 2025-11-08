-- Migration: Add updated_at column to users_profile
-- Version: 011
-- Date: 2025-11-08
-- Description: Add updated_at timestamp column to users_profile table

-- ============================================================================
-- ADD updated_at COLUMN TO users_profile
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users_profile'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE users_profile
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

    RAISE NOTICE 'Added updated_at column to users_profile';
  ELSE
    RAISE NOTICE 'updated_at column already exists in users_profile';
  END IF;
END $$;

-- ============================================================================
-- VERIFY COLUMN EXISTS
-- ============================================================================

SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users_profile'
  AND column_name IN ('created_at', 'updated_at')
ORDER BY column_name;
