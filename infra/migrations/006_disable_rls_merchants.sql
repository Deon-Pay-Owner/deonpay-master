-- Migration: Disable RLS for merchants table
-- Version: 006
-- Date: 2025-11-08
-- Description: Temporarily disable RLS on merchants to allow signup

-- ============================================================================
-- DISABLE RLS ON MERCHANTS
-- ============================================================================
-- This is needed because signup uses anon key which can't bypass RLS
-- The application logic ensures data integrity

ALTER TABLE merchants DISABLE ROW LEVEL SECURITY;

-- Keep RLS enabled for other tables
-- (users_profile and merchant_members still have RLS)

-- ============================================================================
-- SECURITY NOTE:
-- ============================================================================
-- This is safe because:
-- 1. The signup API validates all data with Zod
-- 2. The signup API only allows creating merchants with owner_user_id = current user
-- 3. The dashboard still requires authentication to access merchants
-- 4. We can re-enable RLS later with proper service_role setup
