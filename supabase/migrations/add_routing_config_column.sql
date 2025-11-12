-- Add routing_config column to merchants table
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS routing_config JSONB DEFAULT '{
  "strategy": "default",
  "defaultAdapter": "mock",
  "adapters": {
    "mock": {
      "enabled": true
    }
  }
}'::jsonb;

-- Add comment to column
COMMENT ON COLUMN merchants.routing_config IS 'Payment routing configuration for merchant - determines which acquirer to use';

-- Create index for faster queries on routing_config
CREATE INDEX IF NOT EXISTS idx_merchants_routing_config ON merchants USING GIN (routing_config);

-- Update existing merchants to have default routing_config if null
UPDATE merchants
SET routing_config = '{
  "strategy": "default",
  "defaultAdapter": "mock",
  "adapters": {
    "mock": {
      "enabled": true
    }
  }
}'::jsonb
WHERE routing_config IS NULL;
