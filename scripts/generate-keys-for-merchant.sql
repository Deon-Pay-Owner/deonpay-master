-- SQL Script to generate API keys for an existing merchant
-- Replace 'YOUR_MERCHANT_ID' with the actual merchant ID
-- Replace 'YOUR_USER_ID' with the owner_user_id from the merchants table

-- Set the merchant ID here:
DO $$
DECLARE
    v_merchant_id UUID := '030fba4e-3d47-4587-a323-59abd664c771';
    v_user_id UUID;
    v_merchant_name TEXT;
    v_test_public TEXT;
    v_test_secret TEXT;
    v_test_secret_hash TEXT;
    v_test_secret_prefix TEXT;
    v_live_public TEXT;
    v_live_secret TEXT;
    v_live_secret_hash TEXT;
    v_live_secret_prefix TEXT;
BEGIN
    -- 1. Get merchant details
    SELECT owner_user_id, name INTO v_user_id, v_merchant_name
    FROM merchants
    WHERE id = v_merchant_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Merchant % not found', v_merchant_id;
    END IF;

    RAISE NOTICE 'Found merchant: % (Owner: %)', v_merchant_name, v_user_id;

    -- 2. Check if keys already exist
    IF EXISTS (SELECT 1 FROM api_keys WHERE merchant_id = v_merchant_id) THEN
        RAISE NOTICE 'Warning: Merchant already has API keys. Creating additional keys...';
    END IF;

    -- 3. Generate test keys
    v_test_public := 'pk_test_' || encode(gen_random_bytes(24), 'base64');
    v_test_public := replace(replace(replace(v_test_public, '/', ''), '+', ''), '=', '');
    v_test_public := substring(v_test_public, 1, 40);

    v_test_secret := 'sk_test_' || encode(gen_random_bytes(24), 'base64');
    v_test_secret := replace(replace(replace(v_test_secret, '/', ''), '+', ''), '=', '');
    v_test_secret := substring(v_test_secret, 1, 40);

    -- Hash the secret key
    v_test_secret_hash := encode(digest(v_test_secret, 'sha256'), 'hex');
    v_test_secret_prefix := substring(v_test_secret, 1, 12) || '...';

    -- 4. Generate live keys
    v_live_public := 'pk_live_' || encode(gen_random_bytes(24), 'base64');
    v_live_public := replace(replace(replace(v_live_public, '/', ''), '+', ''), '=', '');
    v_live_public := substring(v_live_public, 1, 40);

    v_live_secret := 'sk_live_' || encode(gen_random_bytes(24), 'base64');
    v_live_secret := replace(replace(replace(v_live_secret, '/', ''), '+', ''), '=', '');
    v_live_secret := substring(v_live_secret, 1, 40);

    -- Hash the secret key
    v_live_secret_hash := encode(digest(v_live_secret, 'sha256'), 'hex');
    v_live_secret_prefix := substring(v_live_secret, 1, 12) || '...';

    -- 5. Insert test key
    INSERT INTO api_keys (
        merchant_id,
        name,
        key_type,
        public_key,
        secret_key_hash,
        secret_key_prefix,
        is_active,
        created_by
    ) VALUES (
        v_merchant_id,
        'Default Test Key',
        'test',
        v_test_public,
        v_test_secret_hash,
        v_test_secret_prefix,
        true,
        v_user_id
    );

    -- 6. Insert live key (inactive by default)
    INSERT INTO api_keys (
        merchant_id,
        name,
        key_type,
        public_key,
        secret_key_hash,
        secret_key_prefix,
        is_active,
        created_by
    ) VALUES (
        v_merchant_id,
        'Default Live Key',
        'live',
        v_live_public,
        v_live_secret_hash,
        v_live_secret_prefix,
        false, -- Live keys start inactive for safety
        v_user_id
    );

    -- 7. Display the generated keys (IMPORTANT: Save these!)
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'API KEYS GENERATED SUCCESSFULLY';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: Save these keys now! The secret keys cannot be recovered later.';
    RAISE NOTICE '';
    RAISE NOTICE 'TEST KEYS (Active):';
    RAISE NOTICE '  Public Key: %', v_test_public;
    RAISE NOTICE '  Secret Key: %', v_test_secret;
    RAISE NOTICE '';
    RAISE NOTICE 'LIVE KEYS (Inactive - activate when ready):';
    RAISE NOTICE '  Public Key: %', v_live_public;
    RAISE NOTICE '  Secret Key: %', v_live_secret;
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Keys have been saved to the api_keys table';
    RAISE NOTICE '========================================';

    COMMIT;
END $$;

-- Verify the keys were created
SELECT
    id,
    name,
    key_type,
    public_key,
    secret_key_prefix,
    is_active,
    created_at
FROM api_keys
WHERE merchant_id = '030fba4e-3d47-4587-a323-59abd664c771'
ORDER BY created_at DESC;