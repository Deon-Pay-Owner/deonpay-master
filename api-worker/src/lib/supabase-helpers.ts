/**
 * Supabase Helper Functions
 *
 * Utilities for working with Supabase, especially RLS context management
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Set merchant context for RLS policies
 * Call this before any database operation that requires RLS context
 *
 * @param supabase Supabase client
 * @param merchantId Merchant ID
 * @param keyType API key type ('test' or 'live')
 */
export async function setMerchantContext(
  supabase: SupabaseClient,
  merchantId: string,
  keyType: string
): Promise<void> {
  const { error } = await supabase.rpc('set_merchant_context', {
    p_merchant_id: merchantId,
    p_key_type: keyType
  })

  if (error) {
    console.error('[Supabase] Failed to set merchant context:', error)
    throw new Error(`Failed to set merchant context: ${error.message}`)
  }
}
