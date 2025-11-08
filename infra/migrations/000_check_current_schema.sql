-- Check current schema
-- Run this FIRST to see what exists

-- 1. Check which tables exist
SELECT
  'Table: ' || table_name as info,
  'EXISTS' as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('merchants', 'users_profile', 'merchant_members')
ORDER BY table_name;

-- 2. Check columns in merchants table (if it exists)
SELECT
  'Column: ' || column_name as info,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'merchants'
ORDER BY ordinal_position;

-- 3. Check columns in users_profile table (if it exists)
SELECT
  'Column: ' || column_name as info,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users_profile'
ORDER BY ordinal_position;

-- 4. Check columns in merchant_members table (if it exists)
SELECT
  'Column: ' || column_name as info,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'merchant_members'
ORDER BY ordinal_position;
