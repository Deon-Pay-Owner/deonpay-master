-- Migration: Create Session Logs table
-- Version: 013
-- Date: 2025-11-08
-- Description: Create table to track user login sessions

-- ============================================================================
-- CREATE SESSION LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session information
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_at TIMESTAMPTZ,

  -- Device and location information
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT, -- mobile, tablet, desktop
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,

  -- Session status
  session_duration INTEGER, -- in seconds
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_session_logs_user_id ON session_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_login_at ON session_logs(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_logs_is_active ON session_logs(is_active) WHERE is_active = true;

-- ============================================================================
-- DISABLE RLS (for now, since we're using anon key)
-- ============================================================================

ALTER TABLE session_logs DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE session_logs IS 'Tracks user login sessions for security and auditing';
COMMENT ON COLUMN session_logs.login_at IS 'When the user logged in';
COMMENT ON COLUMN session_logs.logout_at IS 'When the user logged out (null if still active)';
COMMENT ON COLUMN session_logs.session_duration IS 'Duration of the session in seconds';
COMMENT ON COLUMN session_logs.is_active IS 'Whether the session is currently active';
