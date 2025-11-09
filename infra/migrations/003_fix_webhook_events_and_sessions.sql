-- Fix webhook_events RLS policies and sessions is_active logic
-- This migration ensures webhook_events are properly visible and sessions show correct active status

-- 1. Drop existing RLS policies for webhook_events if they exist
DROP POLICY IF EXISTS "Users can view their webhook events" ON webhook_events;
DROP POLICY IF EXISTS "Users can insert webhook events" ON webhook_events;
DROP POLICY IF EXISTS "Users can update their webhook events" ON webhook_events;

-- 2. Enable RLS on webhook_events if not already enabled
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- 3. Create comprehensive RLS policies for webhook_events
-- Allow users to view webhook events for their merchants
CREATE POLICY "Users can view their webhook events"
  ON webhook_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = webhook_events.merchant_id
      AND merchants.owner_user_id = auth.uid()
    )
  );

-- Allow system/authenticated users to insert webhook events
CREATE POLICY "Users can insert webhook events"
  ON webhook_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = webhook_events.merchant_id
      AND merchants.owner_user_id = auth.uid()
    )
  );

-- Allow users to update webhook events for their merchants
CREATE POLICY "Users can update their webhook events"
  ON webhook_events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM merchants
      WHERE merchants.id = webhook_events.merchant_id
      AND merchants.owner_user_id = auth.uid()
    )
  );

-- 4. Fix session_logs table - update is_active based on logout_at
-- First, let's update existing sessions where logout_at is set but is_active is still true
UPDATE session_logs
SET is_active = false
WHERE logout_at IS NOT NULL
AND is_active = true;

-- 5. Create or replace function to automatically set is_active to false when logout_at is set
CREATE OR REPLACE FUNCTION update_session_active_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If logout_at is being set, automatically set is_active to false
  IF NEW.logout_at IS NOT NULL AND OLD.logout_at IS NULL THEN
    NEW.is_active = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS session_logout_trigger ON session_logs;

CREATE TRIGGER session_logout_trigger
  BEFORE UPDATE ON session_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_session_active_status();

-- 7. Also update is_active for sessions older than 7 days without logout
-- (Sessions that have been open for more than 7 days should be marked as inactive)
UPDATE session_logs
SET is_active = false
WHERE login_at < NOW() - INTERVAL '7 days'
AND logout_at IS NULL
AND is_active = true;

-- 8. Create index for better webhook_events query performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_id ON webhook_events(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_merchant_id ON webhook_events(merchant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- 9. Create index for better session_logs query performance
CREATE INDEX IF NOT EXISTS idx_session_logs_user_id_login_at ON session_logs(user_id, login_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_logs_is_active ON session_logs(is_active);

COMMENT ON TABLE webhook_events IS 'Stores webhook delivery attempts and responses with proper RLS policies';
COMMENT ON TRIGGER session_logout_trigger ON session_logs IS 'Automatically sets is_active to false when logout_at is set';
