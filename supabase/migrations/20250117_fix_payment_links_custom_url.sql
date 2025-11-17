-- Fix UNIQUE constraint for payment_links.custom_url
-- The previous constraint allowed multiple NULL values which is correct,
-- but we need to ensure it only applies when custom_url IS NOT NULL
-- to avoid potential issues with query ambiguity

-- Drop existing constraint
ALTER TABLE payment_links
DROP CONSTRAINT IF EXISTS unique_merchant_custom_url;

-- Add new partial unique constraint (only when custom_url is not null)
-- This ensures custom_url is unique per merchant, but allows multiple NULLs
ALTER TABLE payment_links
ADD CONSTRAINT unique_merchant_custom_url
UNIQUE(merchant_id, custom_url)
WHERE custom_url IS NOT NULL;

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT unique_merchant_custom_url ON payment_links
IS 'Ensures custom_url is unique per merchant when provided, but allows multiple NULL values for auto-generated url_keys';
