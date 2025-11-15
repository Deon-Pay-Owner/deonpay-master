/**
 * Script to generate API keys for an existing merchant
 *
 * Usage: npx tsx scripts/generate-keys-for-merchant.ts <merchant_id>
 *
 * This script is used when a merchant exists but doesn't have API keys generated.
 * It will create both test and live API keys for the merchant.
 */

import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'

// Get merchant ID from command line arguments
const merchantId = process.argv[2]

if (!merchantId) {
  console.error('Usage: npx tsx scripts/generate-keys-for-merchant.ts <merchant_id>')
  process.exit(1)
}

// Validate UUID format
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!uuidRegex.test(merchantId)) {
  console.error('Error: Invalid merchant ID format. Must be a valid UUID.')
  process.exit(1)
}

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing required environment variables')
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
  process.exit(1)
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

/**
 * Generate API key pair (public and secret)
 */
function generateMerchantKeys(environment: 'test' | 'live') {
  const publicKey = `pk_${environment}_${crypto.randomBytes(24).toString('base64url').substring(0, 32)}`
  const secretKey = `sk_${environment}_${crypto.randomBytes(24).toString('base64url').substring(0, 32)}`

  // Hash the secret key for storage
  const secretKeyHash = crypto.createHash('sha256').update(secretKey).digest('hex')

  // Store first 8 chars as prefix for identification
  const secretKeyPrefix = secretKey.substring(0, 12) + '...'

  return {
    publicKey,
    secretKey, // This is shown ONCE to the user
    secretKeyHash,
    secretKeyPrefix,
  }
}

async function generateKeysForMerchant() {
  console.log(`\n=== Generating API Keys for Merchant ${merchantId} ===\n`)

  try {
    // 1. Check if merchant exists
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, name, owner_user_id')
      .eq('id', merchantId)
      .single()

    if (merchantError || !merchant) {
      console.error(`Error: Merchant ${merchantId} not found`)
      process.exit(1)
    }

    console.log(`Found merchant: ${merchant.name}`)
    console.log(`Owner user ID: ${merchant.owner_user_id}`)

    // 2. Check if API keys already exist
    const { data: existingKeys, error: keysError } = await supabase
      .from('api_keys')
      .select('id, name, key_type, created_at')
      .eq('merchant_id', merchantId)

    if (existingKeys && existingKeys.length > 0) {
      console.log(`\nWarning: Merchant already has ${existingKeys.length} API key(s):`)
      existingKeys.forEach(key => {
        console.log(`  - ${key.name} (${key.key_type}) created at ${key.created_at}`)
      })

      const readline = require('readline')
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      })

      const answer = await new Promise<string>((resolve) => {
        rl.question('\nDo you want to generate additional keys? (yes/no): ', resolve)
      })
      rl.close()

      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('Aborted.')
        process.exit(0)
      }
    }

    // 3. Generate test API keys
    console.log('\nGenerating test API keys...')
    const testKeys = generateMerchantKeys('test')

    const { data: testKeyData, error: testKeyError } = await supabase
      .from('api_keys')
      .insert({
        merchant_id: merchantId,
        name: 'Test API Key (Generated)',
        key_type: 'test',
        public_key: testKeys.publicKey,
        secret_key_hash: testKeys.secretKeyHash,
        secret_key_prefix: testKeys.secretKeyPrefix,
        is_active: true,
        created_by: merchant.owner_user_id,
      })
      .select()
      .single()

    if (testKeyError) {
      console.error('Error creating test API key:', testKeyError)
      process.exit(1)
    }

    console.log('✓ Test API key created successfully')

    // 4. Generate live API keys (optional)
    console.log('\nGenerating live API keys...')
    const liveKeys = generateMerchantKeys('live')

    const { data: liveKeyData, error: liveKeyError } = await supabase
      .from('api_keys')
      .insert({
        merchant_id: merchantId,
        name: 'Live API Key (Generated)',
        key_type: 'live',
        public_key: liveKeys.publicKey,
        secret_key_hash: liveKeys.secretKeyHash,
        secret_key_prefix: liveKeys.secretKeyPrefix,
        is_active: false, // Live keys start as inactive for safety
        created_by: merchant.owner_user_id,
      })
      .select()
      .single()

    if (liveKeyError) {
      console.error('Error creating live API key:', liveKeyError)
      process.exit(1)
    }

    console.log('✓ Live API key created successfully (inactive by default)')

    // 5. Display the keys (ONLY TIME THEY'RE SHOWN)
    console.log('\n' + '='.repeat(80))
    console.log('IMPORTANT: Save these keys now! The secret keys cannot be recovered later.')
    console.log('='.repeat(80))

    console.log('\nTEST KEYS:')
    console.log('  Public Key:', testKeys.publicKey)
    console.log('  Secret Key:', testKeys.secretKey)

    console.log('\nLIVE KEYS (inactive - activate in dashboard when ready):')
    console.log('  Public Key:', liveKeys.publicKey)
    console.log('  Secret Key:', liveKeys.secretKey)

    console.log('\n' + '='.repeat(80))
    console.log('Keys generated successfully!')
    console.log('The merchant can now use these keys to authenticate API requests.')
    console.log('='.repeat(80))

  } catch (error) {
    console.error('Unexpected error:', error)
    process.exit(1)
  }
}

// Run the script
generateKeysForMerchant()