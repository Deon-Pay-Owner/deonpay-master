const crypto = require('crypto');

const merchantId = '030fba4e-3d47-4587-a323-59abd664c771';
const pkKey = 'pk_test_' + crypto.randomBytes(24).toString('hex');
const skKey = 'sk_test_' + crypto.randomBytes(24).toString('hex');
const now = new Date().toISOString();

// Hash the secret key using SHA-256 (matches the crypto.ts implementation)
function hashSecretKey(secretKey) {
  const hash = crypto.createHash('sha256');
  hash.update(secretKey);
  return hash.digest('hex');
}

const skHash = hashSecretKey(skKey);
const skPrefix = skKey.substring(0, 12); // First 12 chars for display (e.g., "sk_test_abc...")

console.log(`-- API Keys for Merchant ${merchantId}

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
  '${merchantId}',
  'Default Test Key',
  'test',
  '${pkKey}',
  '${skHash}',
  '${skPrefix}',
  true,
  '${now}',
  '${now}'
);

-- IMPORTANT: Copy these keys immediately - secret key cannot be retrieved later!
-- Publishable Key: ${pkKey}
-- Secret Key: ${skKey}
`);
