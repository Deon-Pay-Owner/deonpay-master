-- Fix UNIQUE constraint for payment_links.custom_url
-- The previous constraint allowed multiple NULL values which is correct,
-- but we need to ensure it only applies when custom_url IS NOT NULL
-- to avoid potential issues with query ambiguity

-- Drop existing constraint
ALTER TABLE payment_links
DROP CONSTRAINT IF EXISTS unique_merchant_custom_url;

-- Drop any existing partial index
DROP INDEX IF EXISTS idx_payment_links_merchant_custom_url;

-- Create a partial unique index (only when custom_url is not null)
-- This ensures custom_url is unique per merchant, but allows multiple NULLs
-- In PostgreSQL, partial unique constraints must be implemented as unique indexes
CREATE UNIQUE INDEX idx_payment_links_merchant_custom_url
ON payment_links(merchant_id, custom_url)
WHERE custom_url IS NOT NULL;

-- Add comment explaining the index
COMMENT ON INDEX idx_payment_links_merchant_custom_url
IS 'Ensures custom_url is unique per merchant when provided, but allows multiple NULL values for auto-generated url_keys';
