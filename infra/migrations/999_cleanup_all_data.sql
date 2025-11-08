-- ============================================================================
-- CLEANUP SCRIPT - Delete all merchants, profiles, and related data
-- ============================================================================
-- WARNING: This will DELETE ALL data from merchants, users_profile, and merchant_members
-- Use this to start fresh with a clean database

-- 1. Delete all merchant members first (foreign key constraint)
DELETE FROM merchant_members;

-- 2. Delete all user profiles
DELETE FROM users_profile;

-- 3. Delete all merchants
DELETE FROM merchants;

-- ============================================================================
-- VERIFICATION QUERIES (run these after to verify cleanup)
-- ============================================================================
-- Uncomment these to verify the cleanup:

-- SELECT COUNT(*) as merchant_members_count FROM merchant_members;
-- SELECT COUNT(*) as users_profile_count FROM users_profile;
-- SELECT COUNT(*) as merchants_count FROM merchants;

-- ============================================================================
-- RESULT
-- ============================================================================
-- You should see "DELETE X" for each table showing how many rows were deleted
-- All tables should now be empty and ready for fresh signups
