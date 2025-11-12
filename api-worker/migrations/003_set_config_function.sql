-- ============================================================================
-- DeonPay API v1 - Set Config Function
-- ============================================================================
-- This migration creates a function that allows the API to set session
-- configuration variables for use in RLS policies
-- ============================================================================

-- Create function to set merchant context
CREATE OR REPLACE FUNCTION set_merchant_context(
  p_merchant_id UUID,
  p_key_type TEXT
)
RETURNS void AS $$
BEGIN
  -- Set merchant_id in session config
  PERFORM set_config('app.merchant_id', p_merchant_id::TEXT, false);

  -- Set key_type in session config
  PERFORM set_config('app.api_key_type', p_key_type, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon role (used by Supabase client)
GRANT EXECUTE ON FUNCTION set_merchant_context(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION set_merchant_context(UUID, TEXT) TO authenticated;

-- Success message
SELECT 'Set config function created successfully!' as message;
