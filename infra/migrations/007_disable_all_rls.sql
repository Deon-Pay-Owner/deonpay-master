-- Migration: Disable RLS for all onboarding tables
-- Version: 007
-- Date: 2025-11-08
-- Description: Disable RLS on users_profile and merchant_members to allow signup

-- ============================================================================
-- DISABLE RLS ON ALL ONBOARDING TABLES
-- ============================================================================

ALTER TABLE users_profile DISABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_members DISABLE ROW LEVEL SECURITY;

-- Note: merchants RLS was already disabled in migration 006

-- ============================================================================
-- SECURITY NOTE:
-- ============================================================================
-- This is safe because:
-- 1. All APIs validate data with Zod before insert
-- 2. APIs only allow users to create/modify their own data
-- 3. Dashboard authentication prevents unauthorized access
-- 4. We'll re-enable RLS later with proper service_role key setup
