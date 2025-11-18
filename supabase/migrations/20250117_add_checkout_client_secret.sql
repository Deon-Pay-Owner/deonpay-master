-- Add client_secret to checkout_sessions table
-- This field is required for DeonPay Elements to authenticate checkout sessions

ALTER TABLE checkout_sessions
ADD COLUMN IF NOT EXISTS client_secret TEXT;

-- Generate a unique client_secret for existing sessions
UPDATE checkout_sessions
SET client_secret = 'cs_' || encode(gen_random_bytes(32), 'hex')
WHERE client_secret IS NULL;

-- Make it NOT NULL with a default value for new sessions
ALTER TABLE checkout_sessions
ALTER COLUMN client_secret SET NOT NULL,
ALTER COLUMN client_secret SET DEFAULT 'cs_' || encode(gen_random_bytes(32), 'hex');

-- Create an index on client_secret for faster lookups
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_client_secret
ON checkout_sessions(client_secret);

-- Add a comment explaining the field
COMMENT ON COLUMN checkout_sessions.client_secret IS 'Unique secret key for client-side authentication of the checkout session. Used by DeonPay Elements.';