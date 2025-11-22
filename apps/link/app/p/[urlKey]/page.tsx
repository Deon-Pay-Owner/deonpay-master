import { notFound } from 'next/navigation'
import PaymentLinkClient from './PaymentLinkClient'

const API_BASE_URL = process.env.NEXT_PUBLIC_DEONPAY_API_URL || 'https://api.deonpay.mx'

export default async function PaymentLinkPage({
  params,
}: {
  params: Promise<{ urlKey: string }>
}) {
  const { urlKey } = await params

  // Fetch payment link from API Worker (public endpoint)
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/payment_links/by-url/${urlKey}`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      console.error('[Payment Link] API error:', response.status, response.statusText)
      notFound()
    }

    const paymentLink = await response.json()

    // Validate link is active and not expired
    if (!paymentLink.active) {
      console.error('[Payment Link] Link is inactive:', paymentLink.id)
      notFound()
    }

    // Check if expired
    const expiresAt = paymentLink.metadata?.expires_at
    if (expiresAt && new Date(expiresAt) < new Date()) {
      console.error('[Payment Link] Link expired:', paymentLink.id, expiresAt)
      notFound()
    }

    // Check max uses
    const restrictions = paymentLink.restrictions?.completed_sessions
    if (restrictions?.enabled && restrictions?.limit) {
      if (paymentLink.completed_sessions_count >= restrictions.limit) {
        console.error('[Payment Link] Max uses reached:', paymentLink.id)
        notFound()
      }
    }

    // Render client component with payment link data
    return <PaymentLinkClient paymentLink={paymentLink} />

  } catch (error) {
    console.error('[Payment Link] Error fetching payment link:', error)
    notFound()
  }
}
