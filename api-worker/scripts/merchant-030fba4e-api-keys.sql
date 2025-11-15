-- API Keys for Merchant 030fba4e-3d47-4587-a323-59abd664c771

INSERT INTO api_keys (
  merchant_id,
  name,
  key_type,
  public_key,
  secret_key_hash,
  secret_key_prefix,
  is_active,
  created_at,
  updated_at
)
VALUES (
  '030fba4e-3d47-4587-a323-59abd664c771',
  'Default Test Key',
  'test',
  'pk_test_16216caec40b318089acb25d2587b1e60bf0f4b2044aadd7',
  'd3ed729067c499309691ea4f01619ef5b76258fe356bf87a467fb353e2289e8f',
  'sk_test_7f1b',
  true,
  '2025-11-14T23:31:50.400Z',
  '2025-11-14T23:31:50.400Z'
);

-- IMPORTANT: Copy these keys immediately - secret key cannot be retrieved later!
-- Publishable Key: pk_test_16216caec40b318089acb25d2587b1e60bf0f4b2044aadd7
-- Secret Key: sk_test_7f1b473edf2ca037a285aee7c65c0f225ecb521afc21c30a
