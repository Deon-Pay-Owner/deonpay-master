-- Roles and Permissions System for DeonPay
-- This migration creates tables for managing team members and their permissions
-- Version 2: Fixed to handle existing tables

-- Drop existing tables if they exist (safer for development)
DROP TABLE IF EXISTS merchant_invitations CASCADE;
DROP TABLE IF EXISTS merchant_members CASCADE;

-- Create merchant_members table
CREATE TABLE merchant_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'finance', 'developer', 'support', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'revoked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_merchant_user UNIQUE(merchant_id, user_id)
);

-- Create merchant_invitations table
CREATE TABLE merchant_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'finance', 'developer', 'support', 'viewer')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_merchant_email_pending UNIQUE(merchant_id, email, status)
);

-- Create indexes for better performance
CREATE INDEX idx_merchant_members_merchant_id ON merchant_members(merchant_id);
CREATE INDEX idx_merchant_members_user_id ON merchant_members(user_id);
CREATE INDEX idx_merchant_members_role ON merchant_members(role);
CREATE INDEX idx_merchant_invitations_merchant_id ON merchant_invitations(merchant_id);
CREATE INDEX idx_merchant_invitations_email ON merchant_invitations(email);
CREATE INDEX idx_merchant_invitations_token ON merchant_invitations(token);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_merchant_members_updated_at BEFORE UPDATE ON merchant_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_merchant_invitations_updated_at BEFORE UPDATE ON merchant_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing merchant owners to merchant_members
-- This ensures all current merchants have an 'owner' entry
INSERT INTO merchant_members (merchant_id, user_id, role, status, accepted_at)
SELECT
  id as merchant_id,
  owner_user_id as user_id,
  'owner' as role,
  'active' as status,
  created_at as accepted_at
FROM merchants
WHERE owner_user_id IS NOT NULL
ON CONFLICT (merchant_id, user_id) DO NOTHING;

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE merchant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_invitations ENABLE ROW LEVEL SECURITY;

-- merchant_members policies
-- Users can view members of merchants they belong to
CREATE POLICY "Users can view members of their merchants"
  ON merchant_members FOR SELECT
  USING (
    merchant_id IN (
      SELECT merchant_id FROM merchant_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Only owners can insert new members (through invitations)
CREATE POLICY "Owners can manage members"
  ON merchant_members FOR ALL
  USING (
    merchant_id IN (
      SELECT merchant_id FROM merchant_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
  );

-- merchant_invitations policies
-- Users can view invitations for merchants they own
CREATE POLICY "Owners can view invitations"
  ON merchant_invitations FOR SELECT
  USING (
    merchant_id IN (
      SELECT merchant_id FROM merchant_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
  );

-- Only owners can create invitations
CREATE POLICY "Owners can create invitations"
  ON merchant_invitations FOR INSERT
  WITH CHECK (
    merchant_id IN (
      SELECT merchant_id FROM merchant_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
  );

-- Only owners can update/delete invitations
CREATE POLICY "Owners can update invitations"
  ON merchant_invitations FOR UPDATE
  USING (
    merchant_id IN (
      SELECT merchant_id FROM merchant_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
  );

CREATE POLICY "Owners can delete invitations"
  ON merchant_invitations FOR DELETE
  USING (
    merchant_id IN (
      SELECT merchant_id FROM merchant_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
  );

-- Function to get user role for a merchant
CREATE OR REPLACE FUNCTION get_user_role(p_merchant_id UUID, p_user_id UUID)
RETURNS TEXT AS $$
  SELECT role
  FROM merchant_members
  WHERE merchant_id = p_merchant_id
    AND user_id = p_user_id
    AND status = 'active'
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION has_permission(
  p_merchant_id UUID,
  p_user_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Get user role
  SELECT role INTO v_role
  FROM merchant_members
  WHERE merchant_id = p_merchant_id
    AND user_id = p_user_id
    AND status = 'active';

  -- If no role found, return false
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Owner has all permissions
  IF v_role = 'owner' THEN
    RETURN TRUE;
  END IF;

  -- Check specific permissions based on role
  -- This is a basic implementation, can be expanded
  RETURN TRUE; -- For now, return true for all active members
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments to tables
COMMENT ON TABLE merchant_members IS 'Team members with access to merchant dashboard';
COMMENT ON TABLE merchant_invitations IS 'Pending invitations to join merchant team';
