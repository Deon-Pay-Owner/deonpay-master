/**
 * Webhook Routes
 * Handles webhook processing and manual dispatch
 */

import { Hono } from 'hono'
import { processPendingWebhooks } from '../webhooks/dispatcher'
import type { HonoContext } from '../types/hono'

const app = new Hono<HonoContext>()

// ============================================================================
// GET /api/v1/cron/process-webhooks - Cron endpoint for webhook processing
// ============================================================================
app.get('/cron/process-webhooks', async (c) => {
  try {
    const supabase = c.get('supabase')

    console.log('[Webhooks Cron] Processing pending webhooks...')

    const processed = await processPendingWebhooks(supabase, 50)

    console.log(`[Webhooks Cron] Processed ${processed} webhooks`)

    return c.json({
      success: true,
      processed,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Webhooks Cron] Error:', error)

    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to process webhooks',
      }
    }, 500)
  }
})

// ============================================================================
// POST /api/v1/webhooks/dispatch - Manual webhook dispatch (authenticated)
// ============================================================================
app.post('/dispatch', async (c) => {
  try {
    const merchantId = c.get('merchantId')
    const supabase = c.get('supabase')

    console.log('[Webhooks] Manual dispatch requested by merchant:', merchantId)

    const processed = await processPendingWebhooks(supabase, 50)

    console.log(`[Webhooks] Manually processed ${processed} webhooks`)

    return c.json({
      success: true,
      processed,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Webhooks] Manual dispatch error:', error)

    return c.json({
      error: {
        type: 'api_error',
        message: error.message || 'Failed to dispatch webhooks',
      }
    }, 500)
  }
})

export { app as webhooksRouter }
