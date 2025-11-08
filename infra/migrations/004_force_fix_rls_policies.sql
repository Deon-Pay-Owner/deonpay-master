-- Migration: Force fix RLS policies to avoid infinite recursion
-- Version: 004
-- Date: 2025-11-08
-- Description: Forces drop and recreate of all RLS policies to remove circular dependencies

-- ============================================================================
-- DROP ALL EXISTING POLICIES (FORCED)
-- ============================================================================

-- Drop all merchants policies
DROP POLICY IF EXISTS "Users can view their merchants" ON merchants CASCADE;
DROP POLICY IF EXISTS "Users can view their own merchants" ON merchants CASCADE;
DROP POLICY IF EXISTS "Users can insert their own merchants" ON merchants CASCADE;
DROP POLICY IF EXISTS "Users can update their merchants" ON merchants CASCADE;
DROP POLICY IF EXISTS "Users can update their own merchants" ON merchants CASCADE;
DROP POLICY IF EXISTS "Users can delete their own merchants" ON merchants CASCADE;

-- Drop all users_profile policies
DROP POLICY IF EXISTS "Users can view their own profile" ON users_profile CASCADE;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users_profile CASCADE;
DROP POLICY IF EXISTS "Users can update their own profile" ON users_profile CASCADE;
DROP POLICY IF EXISTS "Users can delete their own profile" ON users_profile CASCADE;

-- Drop all merchant_members policies
DROP POLICY IF EXISTS "Users can view merchant members" ON merchant_members CASCADE;
DROP POLICY IF EXISTS "Users can view their own memberships" ON merchant_members CASCADE;
DROP POLICY IF EXISTS "Owners can manage members" ON merchant_members CASCADE;
DROP POLICY IF EXISTS "Owners can add members" ON merchant_members CASCADE;
DROP POLICY IF EXISTS "Owners can update members" ON merchant_members CASCADE;
DROP POLICY IF EXISTS "Owners can delete members" ON merchant_members CASCADE;

-- ============================================================================
-- MERCHANTS POLICIES (SIMPLIFIED - NO CIRCULAR REFERENCE)
-- ============================================================================

-- Users can view merchants they own (direct owner check - NO JOIN)
CREATE POLICY "merchants_select_owner" ON merchants
  FOR SELECT
  USING (auth.uid() = owner_user_id);

-- Users can insert merchants they own
CREATE POLICY "merchants_insert_owner" ON merchants
  FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

-- Users can update merchants they own (direct owner check - NO JOIN)
CREATE POLICY "merchants_update_owner" ON merchants
  FOR UPDATE
  USING (auth.uid() = owner_user_id);

-- Users can delete merchants they own
CREATE POLICY "merchants_delete_owner" ON merchants
  FOR DELETE
  USING (auth.uid() = owner_user_id);

-- ============================================================================
-- USERS_PROFILE POLICIES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "users_profile_select_own" ON users_profile
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own profile
CREATE POLICY "users_profile_insert_own" ON users_profile
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "users_profile_update_own" ON users_profile
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own profile
CREATE POLICY "users_profile_delete_own" ON users_profile
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- MERCHANT_MEMBERS POLICIES (SIMPLIFIED)
-- ============================================================================

-- Users can view their own memberships
CREATE POLICY "merchant_members_select_own" ON merchant_members
  FOR SELECT
  USING (user_id = auth.uid());

-- Merchant owners can insert members (direct owner check - NO JOIN to merchant_members)
CREATE POLICY "merchant_members_insert_owner" ON merchant_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = merchant_members.merchant_id
      AND merchants.owner_user_id = auth.uid()
    )
    OR user_id = auth.uid()  -- Allow users to be added as members
  );

-- Merchant owners can update members
CREATE POLICY "merchant_members_update_owner" ON merchant_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = merchant_members.merchant_id
      AND merchants.owner_user_id = auth.uid()
    )
  );

-- Merchant owners can delete members
CREATE POLICY "merchant_members_delete_owner" ON merchant_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = merchant_members.merchant_id
      AND merchants.owner_user_id = auth.uid()
    )
    OR user_id = auth.uid()  -- Users can remove themselves
  );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration fixes the infinite recursion error by:
-- 1. Forcing drop of ALL existing policies (even with different names)
-- 2. Using new unique policy names to avoid conflicts
-- 3. Removing circular references between merchants and merchant_members
-- 4. Using only direct owner_user_id checks for merchant policies
-- 5. Simplifying all policy logic
