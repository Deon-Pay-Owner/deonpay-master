/**
 * Rate Limit Store
 * Stores rate limit counters with KV fallback to DB
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export class RateLimitStore {
  private supabase: SupabaseClient
  private kv?: KVNamespace

  constructor(supabase: SupabaseClient, kv?: KVNamespace) {
    this.supabase = supabase
    this.kv = kv
  }

  async checkAndIncrement(
    merchantId: string,
    routeKey: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const key = `ratelimit:${merchantId}:${routeKey}`
    const now = Date.now()
    const windowStart = now - config.windowMs
    const resetAt = now + config.windowMs

    if (this.kv) {
      // Use KV if available
      const value = await this.kv.get(key, { type: 'json' }) as { count: number; resetAt: number } | null
      
      if (!value || value.resetAt < now) {
        // New window
        await this.kv.put(key, JSON.stringify({ count: 1, resetAt }), { expirationTtl: Math.ceil(config.windowMs / 1000) })
        return { allowed: true, remaining: config.maxRequests - 1, resetAt }
      }

      const newCount = value.count + 1
      if (newCount > config.maxRequests) {
        return { allowed: false, remaining: 0, resetAt: value.resetAt }
      }

      await this.kv.put(key, JSON.stringify({ count: newCount, resetAt: value.resetAt }), { expirationTtl: Math.ceil((value.resetAt - now) / 1000) })
      return { allowed: true, remaining: config.maxRequests - newCount, resetAt: value.resetAt }
    }

    // Fallback to DB (simple table-based implementation)
    // This is less efficient but works without KV
    const { data: hits } = await this.supabase
      .from('rate_limit_hits')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('route_key', routeKey)
      .gte('created_at', new Date(windowStart).toISOString())

    const count = hits?.length || 0

    if (count >= config.maxRequests) {
      return { allowed: false, remaining: 0, resetAt }
    }

    // Insert new hit
    await this.supabase
      .from('rate_limit_hits')
      .insert({ merchant_id: merchantId, route_key: routeKey })

    return { allowed: true, remaining: config.maxRequests - count - 1, resetAt }
  }
}
