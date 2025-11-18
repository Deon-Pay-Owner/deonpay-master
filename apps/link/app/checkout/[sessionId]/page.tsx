import CheckoutClient from './CheckoutClient'

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

  return <CheckoutClient sessionId={sessionId} />
}
