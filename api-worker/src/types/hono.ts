/**
 * Shared Hono types for route handlers
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type Bindings = {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  ENVIRONMENT: string
  DEFAULT_ADAPTER?: string
  RATE_LIMIT_KV?: KVNamespace
  IDEMPOTENCY_KV?: KVNamespace
  TOKENS_KV?: KVNamespace
  ENCRYPTION_KEY?: string
  RATE_LIMIT_MAX?: string
  RATE_LIMIT_WINDOW_MS?: string
  IDEMPOTENCY_TTL_SECONDS?: string
}

export type Variables = {
  supabase: SupabaseClient
  requestId: string
  merchantId: string
  apiKey: any
}

export type HonoContext = { Bindings: Bindings; Variables: Variables }
