import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function PaymentLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ urlKey: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { urlKey } = await params
  const search = await searchParams
  const supabase = await createClient()

  // Fetch the payment link (prioritize custom_url, then ID, then url_key)
  let paymentLink: any = null
  let linkError: any = null

  // First, try to find by custom_url (most specific)
  const { data: customUrlLink, error: customUrlError } = await supabase
    .from('payment_links')
    .select('*')
    .eq('custom_url', urlKey)
    .eq('active', true)
    .maybeSingle()

  if (customUrlLink) {
    paymentLink = customUrlLink
    console.log('[Payment Link] Found by custom_url:', { id: customUrlLink.id, custom_url: customUrlLink.custom_url })
  } else {
    // Check if urlKey is a valid UUID format
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(urlKey)

    if (isUUID) {
      // Try to find by ID
      const { data: idLink, error } = await supabase
        .from('payment_links')
        .select('*')
        .eq('id', urlKey)
        .eq('active', true)
        .maybeSingle()

      if (idLink) {
        paymentLink = idLink
        console.log('[Payment Link] Found by ID:', { id: idLink.id })
      } else {
        linkError = error
        console.log('[Payment Link] Not found by ID:', { urlKey, error })
      }
    } else {
      // If not UUID, try url_key as fallback (for backwards compatibility)
      const { data: urlKeyLink, error } = await supabase
        .from('payment_links')
        .select('*')
        .eq('url_key', urlKey)
        .eq('active', true)
        .maybeSingle()

      if (urlKeyLink) {
        paymentLink = urlKeyLink
        console.log('[Payment Link] Found by url_key:', { id: urlKeyLink.id, url_key: urlKeyLink.url_key })
      } else {
        linkError = error
        console.log('[Payment Link] Not found by url_key:', { urlKey, error })
      }
    }
  }

  if (linkError || !paymentLink) {
    console.error('[Payment Link] Not found - exhausted all search methods:', {
      urlKey,
      searchedBy: {
        custom_url: !!customUrlError,
        isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(urlKey),
        url_key: !(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(urlKey))
      },
      error: linkError,
      errorMessage: linkError?.message,
      errorCode: linkError?.code,
      errorDetails: linkError?.details,
      timestamp: new Date().toISOString()
    })
    notFound()
  }

  // Increment click analytics (optional - don't fail if RPC doesn't exist)
  try {
    await supabase.rpc('increment_payment_link_stats', {
      p_link_id: paymentLink.id,
      p_event_type: 'click'
    })
  } catch (error) {
    console.warn('[Payment Link] Could not increment stats:', error)
  }

  // Parse line items
  const lineItems = paymentLink.line_items as Array<{
    product_id: string
    quantity: number
    price_data?: any
  }>

  if (!lineItems || lineItems.length === 0) {
    console.error('[Payment Link] No line items:', {
      paymentLinkId: paymentLink.id,
      lineItems: paymentLink.line_items,
      timestamp: new Date().toISOString()
    })
    notFound()
  }

  // Get product information for line items
  const productIds = lineItems.map(item => item.product_id).filter(Boolean)

  // Fetch products only if there are product IDs
  const validProducts: any[] = []
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)

    if (products) {
      validProducts.push(...products)
    }
  }

  // Calculate total amount
  let totalAmount = 0
  const sessionLineItems = lineItems.map(item => {
    // If item has product_id, try to find the product
    if (item.product_id) {
      const product = validProducts.find(p => p.id === item.product_id)

      if (!product) {
        // Log warning but DON'T fail - try to use price_data as fallback
        console.warn(`Product ${item.product_id} not found, checking for price_data fallback...`)

        // If line_item has price_data as fallback, use it
        if (item.price_data) {
          const itemAmount = item.price_data.unit_amount * (item.quantity || 1)
          totalAmount += itemAmount

          return {
            product_id: item.product_id,
            quantity: item.quantity || 1,
            amount_subtotal: itemAmount,
            amount_total: itemAmount,
            amount_tax: 0,
            amount_discount: 0,
            name: item.price_data.product_data?.name || 'Producto',
            description: item.price_data.product_data?.description || '',
            images: item.price_data.product_data?.images || [],
            price_data: item.price_data
          }
        }

        // No product and no price_data - skip this item
        console.error(`Skipping line item: no product found and no price_data available for ${item.product_id}`)
        return null
      }

      // Product found - use product data
      const itemAmount = product.unit_amount * (item.quantity || 1)
      totalAmount += itemAmount

      return {
        product_id: product.id,
        quantity: item.quantity || 1,
        amount_subtotal: itemAmount,
        amount_total: itemAmount,
        amount_tax: 0,
        amount_discount: 0,
        name: product.name,
        description: product.description,
        images: product.images || [],
        price_data: {
          unit_amount: product.unit_amount,
          currency: product.currency
        }
      }
    } else if (item.price_data) {
      // No product_id but has price_data - use price_data directly
      const itemAmount = item.price_data.unit_amount * (item.quantity || 1)
      totalAmount += itemAmount

      return {
        quantity: item.quantity || 1,
        amount_subtotal: itemAmount,
        amount_total: itemAmount,
        amount_tax: 0,
        amount_discount: 0,
        name: item.price_data.product_data?.name || 'Producto',
        description: item.price_data.product_data?.description || '',
        images: item.price_data.product_data?.images || [],
        price_data: item.price_data
      }
    }

    return null
  }).filter(Boolean)

  // Validate that we have at least one valid line item
  if (sessionLineItems.length === 0) {
    console.error('[Payment Link] No valid line items:', {
      paymentLinkId: paymentLink.id,
      originalLineItems: lineItems,
      productIds,
      validProductsFound: validProducts.length,
      timestamp: new Date().toISOString()
    })
    notFound()
  }

  // Create a checkout session
  const { data: checkoutSession, error: sessionError } = await supabase
    .from('checkout_sessions')
    .insert({
      merchant_id: paymentLink.merchant_id,
      mode: paymentLink.type === 'subscription' ? 'subscription' : 'payment',
      status: 'open',
      currency: paymentLink.currency,
      amount_total: totalAmount,
      amount_subtotal: totalAmount,
      success_url: paymentLink.after_completion_url || `https://link.deonpay.mx/success`,
      cancel_url: `https://link.deonpay.mx/${urlKey}`,
      billing_address_collection: paymentLink.billing_address_collection || 'auto',
      shipping_address_collection: paymentLink.shipping_address_collection,
      allow_promotion_codes: paymentLink.allow_promotion_codes || false,
      metadata: {
        payment_link_id: paymentLink.id,
        ...search
      }
    })
    .select('*')  // Select all fields including url_key
    .single()

  if (sessionError || !checkoutSession) {
    console.error('Error creating checkout session:', sessionError)
    throw new Error('Failed to create checkout session')
  }

  // Log the session details for debugging
  console.log('[Payment Link] Created checkout session:', {
    id: checkoutSession.id,
    url_key: checkoutSession.url_key,
    merchant_id: checkoutSession.merchant_id,
    payment_link_id: paymentLink.id
  })

  // Insert line items
  if (sessionLineItems.length > 0) {
    const { error: lineItemsError } = await supabase
      .from('checkout_line_items')
      .insert(
        sessionLineItems.map(item => ({
          checkout_session_id: checkoutSession.id,
          ...item
        }))
      )

    if (lineItemsError) {
      console.error('Error creating line items:', lineItemsError)
    }
  }

  // Track analytics (optional - don't fail if table doesn't exist)
  try {
    await supabase
      .from('payment_link_analytics')
      .insert({
        payment_link_id: paymentLink.id,
        event_type: 'checkout_started',
        checkout_session_id: checkoutSession.id,
        session_id: checkoutSession.url_key
      })
  } catch (error) {
    console.warn('[Payment Link] Could not track analytics:', error)
  }

  // Ensure we have a url_key before redirecting
  if (!checkoutSession.url_key) {
    console.error('[Payment Link] No url_key in checkout session:', checkoutSession)
    throw new Error('Checkout session missing url_key')
  }

  // Redirect to checkout page
  redirect(`/checkout/${checkoutSession.url_key}`)
}
