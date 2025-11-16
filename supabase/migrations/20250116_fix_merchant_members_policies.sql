-- Fix infinite recursion in merchant_members RLS policies
-- The policies were querying merchant_members within merchant_members policies,
-- causing infinite recursion

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view members of their merchants" ON merchant_members;
DROP POLICY IF EXISTS "Owners can manage members" ON merchant_members;
DROP POLICY IF EXISTS "Owners can view invitations" ON merchant_invitations;
DROP POLICY IF EXISTS "Owners can create invitations" ON merchant_invitations;
DROP POLICY IF EXISTS "Owners can update invitations" ON merchant_invitations;
DROP POLICY IF EXISTS "Owners can delete invitations" ON merchant_invitations;

-- ============================================================================
-- MERCHANT_MEMBERS POLICIES (Fixed to avoid recursion)
-- ============================================================================

-- Policy: Users can view members of merchants they own
CREATE POLICY "Users can view members of merchants they own"
  ON merchant_members FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

-- Policy: Only owners can insert new members
CREATE POLICY "Owners can insert members"
  ON merchant_members FOR INSERT
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

-- Policy: Only owners can update members
CREATE POLICY "Owners can update members"
  ON merchant_members FOR UPDATE
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

-- Policy: Only owners can delete members
CREATE POLICY "Owners can delete members"
  ON merchant_members FOR DELETE
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- MERCHANT_INVITATIONS POLICIES (Fixed to avoid recursion)
-- ============================================================================

-- Policy: Owners can view invitations
CREATE POLICY "Owners can view invitations"
  ON merchant_invitations FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

-- Policy: Owners can create invitations
CREATE POLICY "Owners can create invitations"
  ON merchant_invitations FOR INSERT
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

-- Policy: Owners can update invitations
CREATE POLICY "Owners can update invitations"
  ON merchant_invitations FOR UPDATE
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

-- Policy: Owners can delete invitations
CREATE POLICY "Owners can delete invitations"
  ON merchant_invitations FOR DELETE
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );
