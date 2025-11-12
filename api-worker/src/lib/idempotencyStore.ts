/**
 * Idempotency Store
 * Stores idempotency records with KV fallback to DB
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface IdempotencyRecord {
  merchant_id: string
  endpoint: string
  idempotency_key: string
  body_hash: string
  status: number
  response: any
  headers: Record<string, string>
}

export class IdempotencyStore {
  private supabase: SupabaseClient
  private kv?: KVNamespace
  private ttlSeconds: number

  constructor(supabase: SupabaseClient, kv?: KVNamespace, ttlSeconds = 86400) {
    this.supabase = supabase
    this.kv = kv
    this.ttlSeconds = ttlSeconds
  }

  private getKey(merchantId: string, endpoint: string, idempotencyKey: string): string {
    return `idempotency:${merchantId}:${endpoint}:${idempotencyKey}`
  }

  async get(merchantId: string, endpoint: string, idempotencyKey: string): Promise<IdempotencyRecord | null> {
    const key = this.getKey(merchantId, endpoint, idempotencyKey)

    if (this.kv) {
      const value = await this.kv.get(key, { type: 'json' }) as IdempotencyRecord | null
      if (value) return value
    }

    // Fallback to DB
    const { data } = await this.supabase
      .from('idempotency_records')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('endpoint', endpoint)
      .eq('idempotency_key', idempotencyKey)
      .single()

    return data
  }

  async set(record: IdempotencyRecord): Promise<void> {
    const key = this.getKey(record.merchant_id, record.endpoint, record.idempotency_key)

    if (this.kv) {
      await this.kv.put(key, JSON.stringify(record), { expirationTtl: this.ttlSeconds })
    }

    // Always store in DB as well (for persistence)
    await this.supabase
      .from('idempotency_records')
      .upsert({
        ...record,
        ttl: new Date(Date.now() + this.ttlSeconds * 1000).toISOString(),
      })
  }
}
