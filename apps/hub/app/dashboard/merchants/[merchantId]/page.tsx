import { createClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import MerchantDetailsClient from './MerchantDetailsClient'

export default async function MerchantDetailsPage({
  params,
}: {
  params: Promise<{ merchantId: string }>
}) {
  const { merchantId } = await params
  const supabase = await createClient()

  // Fetch merchant details
  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('id', merchantId)
    .single()

  if (error || !merchant) {
    notFound()
  }

  // Fetch recent transactions
  const { data: transactions } = await supabase
    .from('payment_intents')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <MerchantDetailsClient
      merchant={merchant}
      transactions={transactions || []}
    />
  )
}
