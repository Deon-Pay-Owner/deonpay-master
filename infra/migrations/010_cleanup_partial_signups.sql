-- Migration: Cleanup partial signups
-- Version: 010
-- Date: 2025-11-08
-- Description: Clean up users created during testing that have incomplete data

-- ============================================================================
-- CLEANUP PARTIAL SIGNUPS
-- ============================================================================

-- Step 1: Show what we're about to delete
SELECT 'Merchant members to delete:' as info, COUNT(*) as count FROM merchant_members;
SELECT 'Users profiles to delete:' as info, COUNT(*) as count FROM users_profile;
SELECT 'Merchants to delete:' as info, COUNT(*) as count FROM merchants;

-- Step 2: Delete all data (in correct order to respect foreign keys)
DELETE FROM merchant_members;
DELETE FROM users_profile;
DELETE FROM merchants;

-- Step 3: Verify deletion
SELECT 'After cleanup:' as info;
SELECT 'Merchant members remaining:' as info, COUNT(*) as count FROM merchant_members;
SELECT 'Users profiles remaining:' as info, COUNT(*) as count FROM users_profile;
SELECT 'Merchants remaining:' as info, COUNT(*) as count FROM merchants;

-- ============================================================================
-- NOTE: You also need to manually delete users from Supabase Auth
-- ============================================================================
-- Go to Authentication > Users in Supabase dashboard and delete all test users
-- OR run this if you have service_role access:
-- DELETE FROM auth.users;
