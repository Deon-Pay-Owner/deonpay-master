'use client'

import { useState, useEffect, useRef } from 'react'
import { Lock, ShoppingCart, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// Type cast lucide-react icons for React 19 compatibility
const LockIcon = Lock as any
const ShoppingCartIcon = ShoppingCart as any
const AlertCircleIcon = AlertCircle as any
const CheckCircleIcon = CheckCircle as any
const ArrowLeftIcon = ArrowLeft as any

interface CheckoutSession {
  id: string
  url_key: string
  mode: string
  currency: string
  amount_total: number
  amount_subtotal: number
  amount_tax: number
  client_secret: string
  line_items: Array<{
    id: string
    name: string
    description?: string
    images: string[]
    quantity: number
    amount_total: number
    amount_subtotal: number
  }>
  merchant: {
    id: string
    name: string
    logo_url?: string
    support_email?: string
    support_phone?: string
    public_key: string
  }
  expires_at: string
  billing_address_collection?: string
  shipping_address_collection?: any
  custom_fields?: any[]
  consent_collection?: any
  locale: string
  status: string
}

declare global {
  interface Window {
    DeonPay: any
  }
}

export default function CheckoutClient({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<CheckoutSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)

  // Form state
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  // DeonPay Elements
  const deonpayRef = useRef<any>(null)
  const elementsRef = useRef<any>(null)
  const paymentElementRef = useRef<any>(null)
  const billingElementRef = useRef<any>(null)
  const [mounted, setMounted] = useState(false)
  const [elementsReady, setElementsReady] = useState(false)

  useEffect(() => {
    fetchSession()
  }, [sessionId])

  // Load DeonPay SDK and CSS
  useEffect(() => {
    // Load CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://elements.deonpay.mx/sdk/deonpay-elements.css'
    document.head.appendChild(link)

    // Load JS
    const script = document.createElement('script')
    script.src = 'https://elements.deonpay.mx/sdk/deonpay-elements.js'
    script.async = true
    script.onload = () => {
      console.log('DeonPay SDK loaded')
    }
    document.body.appendChild(script)

    return () => {
      document.head.removeChild(link)
      document.body.removeChild(script)
    }
  }, [])

  // Initialize Elements when session and SDK are ready
  useEffect(() => {
    if (!session || !session.client_secret || !window.DeonPay) return
    if (elementsRef.current) return // Already initialized

    initializeElements()
  }, [session])

  const fetchSession = async () => {
    try {
      setLoading(true)

      const response = await fetch(`https://api.deonpay.mx/api/v1/checkout/sessions/by-url/${sessionId}`)

      if (!response.ok) {
        throw new Error('Sesión de checkout no encontrada o expirada')
      }

      const data = await response.json()

      // Check if session is expired or already completed
      if (data.status === 'expired') {
        throw new Error('Esta sesión de checkout ha expirado')
      }

      if (data.status === 'completed') {
        setPaymentComplete(true)
        setEmail(data.customer_email || '')
      }

      setSession(data)
    } catch (err: any) {
      setError(err.message || 'Error al cargar la sesión de checkout')
    } finally {
      setLoading(false)
    }
  }

  const initializeElements = async () => {
    try {
      if (!session || !window.DeonPay) return

      console.log('Initializing DeonPay Elements...')

      // Initialize DeonPay
      const deonpay = window.DeonPay(session.merchant.public_key, {
        apiUrl: 'https://api.deonpay.mx'
      })
      deonpayRef.current = deonpay

      // Create Elements instance
      const elements = deonpay.elements({
        clientSecret: session.client_secret,
        appearance: {
          theme: 'flat',
          variables: {
            colorPrimary: '#4F46E5', // indigo-600
            borderRadius: '8px',
            fontSize: '14px',
          },
        },
      })
      elementsRef.current = elements

      // Wait for DOM to be ready
      setTimeout(() => {
        // Mount Payment Element
        const paymentContainer = document.getElementById('payment-element')
        if (paymentContainer) {
          const paymentElement = elements.create('payment')
          paymentElement.mount('#payment-element')
          paymentElementRef.current = paymentElement

          paymentElement.on('ready', () => {
            console.log('Payment element ready')
            setElementsReady(true)
          })

          paymentElement.on('change', (event: any) => {
            if (event.error) {
              setError(event.error.message)
            } else {
              setError(null)
            }
          })
        }

        // Mount Billing Element if required
        if (session.billing_address_collection) {
          const billingContainer = document.getElementById('billing-element')
          if (billingContainer) {
            const billingElement = elements.create('billing', {
              fields: {
                name: 'auto',
                email: 'auto',
                phone: session.billing_address_collection === 'required' ? 'auto' : 'never',
                address: {
                  line1: 'auto',
                  line2: 'auto',
                  city: 'auto',
                  state: 'auto',
                  postal_code: 'auto',
                  country: 'auto',
                },
              },
            })
            billingElement.mount('#billing-element')
            billingElementRef.current = billingElement
          }
        }

        setMounted(true)
      }, 100)

    } catch (err: any) {
      console.error('Error initializing Elements:', err)
      setError('Error al cargar el formulario de pago')
    }
  }

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!elementsRef.current || !deonpayRef.current) {
      setError('El formulario de pago no está listo')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      // Confirm the payment with DeonPay
      const result = await deonpayRef.current.confirmPayment({
        elements: elementsRef.current,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/${sessionId}/success`,
        },
        redirect: 'if_required',
      })

      if (result.error) {
        setError(result.error.message || 'Error al procesar el pago')
        setProcessing(false)
        return
      }

      // Payment successful
      if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        setPaymentIntentId(result.paymentIntent.id)

        // Complete the checkout session
        await completeCheckoutSession(result.paymentIntent.id)

        setPaymentComplete(true)
      } else {
        setError('El pago no pudo ser completado')
      }

    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message || 'Error al procesar el pago')
    } finally {
      setProcessing(false)
    }
  }

  const completeCheckoutSession = async (paymentIntentId: string) => {
    try {
      const response = await fetch(`https://api.deonpay.mx/api/v1/checkout/sessions/${session!.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_intent_id: paymentIntentId,
          customer_email: email,
          customer_name: name,
          customer_phone: phone || undefined,
        }),
      })

      if (!response.ok) {
        console.error('Failed to complete checkout session')
      }
    } catch (err) {
      console.error('Error completing checkout session:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--color-background)]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mb-4"></div>
          <p className="text-[var(--color-textSecondary)]">Cargando checkout...</p>
        </div>
      </div>
    )
  }

  if (error && !session) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-[var(--color-background)]">
        <div className="max-w-md w-full bg-[var(--color-surface)] rounded-2xl shadow-xl p-8 text-center border border-[var(--color-border)]">
          <AlertCircleIcon className="w-16 h-16 text-[var(--color-danger)] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[var(--color-textPrimary)] mb-2">
            Error
          </h2>
          <p className="text-[var(--color-textSecondary)] mb-6">
            {error}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primaryHover)] transition-colors"
          >
            <ArrowLeftIcon size={18} />
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  if (paymentComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-[var(--color-background)]">
        <div className="max-w-md w-full bg-[var(--color-surface)] rounded-2xl shadow-xl p-8 text-center border border-[var(--color-border)]">
          <div className="w-16 h-16 bg-[var(--color-success)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="w-10 h-10 text-[var(--color-success)]" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-textPrimary)] mb-2">
            ¡Pago Exitoso!
          </h2>
          <p className="text-[var(--color-textSecondary)] mb-6">
            Tu pago ha sido procesado correctamente. Te hemos enviado un correo de confirmación a{' '}
            <span className="font-medium text-[var(--color-textPrimary)]">{email}</span>.
          </p>
          <div className="p-4 bg-[var(--color-background)] rounded-lg mb-6 border border-[var(--color-border)]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[var(--color-textSecondary)]">Total pagado</span>
              <span className="text-xl font-bold text-[var(--color-textPrimary)]">
                {session && formatPrice(session.amount_total, session.currency)}
              </span>
            </div>
            {paymentIntentId && (
              <div className="text-xs text-[var(--color-textSecondary)] mt-2 font-mono">
                ID: {paymentIntentId}
              </div>
            )}
          </div>
          {session?.merchant.support_email && (
            <p className="text-sm text-[var(--color-textSecondary)]">
              ¿Necesitas ayuda? Contáctanos en{' '}
              <a
                href={`mailto:${session.merchant.support_email}`}
                className="text-[var(--color-primary)] hover:underline"
              >
                {session.merchant.support_email}
              </a>
            </p>
          )}
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen py-6 sm:py-12 px-4 bg-[var(--color-background)]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          {session.merchant.logo_url && (session.merchant.logo_url.startsWith('http://') || session.merchant.logo_url.startsWith('https://')) ? (
            <img
              src={session.merchant.logo_url}
              alt={session.merchant.name}
              className="h-10 sm:h-12 max-w-[200px] sm:max-w-xs mx-auto mb-3 sm:mb-4 object-contain"
            />
          ) : (
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-textPrimary)] mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
              {session.merchant.name}
            </h1>
          )}
          <p className="text-xs sm:text-sm text-[var(--color-textSecondary)]">
            Checkout seguro
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Left: Payment Form - Shows second on mobile (order-2), first on desktop (lg:order-1) */}
          <div className="order-2 lg:order-1">
            <div className="bg-[var(--color-surface)] rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8 border border-[var(--color-border)]">
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-textPrimary)] mb-4 sm:mb-6" style={{ fontFamily: 'var(--font-heading)' }}>
                Información de pago
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 rounded-lg flex items-start gap-3">
                    <AlertCircleIcon className="w-5 h-5 text-[var(--color-danger)] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-[var(--color-danger)]">{error}</p>
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-textPrimary)] mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    className="input-field w-full"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-textPrimary)] mb-2">
                    Nombre completo *
                  </label>
                  <input
                    type="text"
                    required
                    className="input-field w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Juan Pérez"
                  />
                </div>

                {/* Phone (optional) */}
                {!session.billing_address_collection && (
                  <div>
                    <label className="block text-sm font-semibold text-[var(--color-textPrimary)] mb-2">
                      Teléfono (opcional)
                    </label>
                    <input
                      type="tel"
                      className="input-field w-full"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+52 123 456 7890"
                    />
                  </div>
                )}

                {/* Payment Element */}
                <div>
                  <label className="block text-sm font-semibold text-[var(--color-textPrimary)] mb-2">
                    Tarjeta de crédito o débito *
                  </label>
                  <div
                    id="payment-element"
                    className={`min-h-[200px] ${!mounted ? 'border-2 border-dashed border-[var(--color-border)] rounded-lg p-8 flex items-center justify-center' : ''}`}
                  >
                    {!mounted && (
                      <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)] mb-2"></div>
                        <p className="text-sm text-[var(--color-textSecondary)]">
                          Cargando formulario de pago...
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Billing Element (if required) */}
                {session.billing_address_collection && (
                  <div>
                    <label className="block text-sm font-semibold text-[var(--color-textPrimary)] mb-2">
                      Información de facturación *
                    </label>
                    <div id="billing-element" className="min-h-[200px]"></div>
                  </div>
                )}

                {/* Security notice */}
                <div className="flex items-center gap-2 text-sm text-[var(--color-textSecondary)]">
                  <LockIcon size={16} className="text-[var(--color-success)]" />
                  <span>Pago seguro y encriptado con SSL</span>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={processing || !elementsReady}
                  className="w-full px-6 py-4 bg-[var(--color-primary)] text-white rounded-lg font-semibold text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {processing ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Procesando pago...
                    </div>
                  ) : (
                    `Pagar ${formatPrice(session.amount_total, session.currency)}`
                  )}
                </button>
              </form>
            </div>

            {/* Powered by */}
            <div className="text-center mt-6">
              <p className="text-sm text-[var(--color-textSecondary)]">
                Powered by{' '}
                <a
                  href="https://deonpay.mx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[var(--color-primary)] hover:underline"
                >
                  DeonPay
                </a>
              </p>
            </div>
          </div>

          {/* Right: Order Summary - Shows first on mobile (order-1), second on desktop (lg:order-2) */}
          <div className="order-1 lg:order-2">
            <div className="bg-[var(--color-surface)] rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8 lg:sticky lg:top-8 border border-[var(--color-border)]">
              <h2 className="text-lg sm:text-xl font-bold text-[var(--color-textPrimary)] mb-4 sm:mb-6 flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
                <ShoppingCartIcon size={20} className="sm:w-6 sm:h-6" />
                Resumen de compra
              </h2>

              {/* Line Items */}
              <div className="space-y-4 mb-6">
                {session.line_items.map((item) => (
                  <div key={item.id} className="flex gap-3 sm:gap-4">
                    {/* Image */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[var(--color-primary)] to-blue-400 rounded-lg flex items-center justify-center flex-shrink-0">
                      {item.images && item.images.length > 0 ? (
                        <img
                          src={item.images[0]}
                          alt={item.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <ShoppingCartIcon className="w-6 h-6 sm:w-8 sm:h-8 text-white/80" />
                      )}
                    </div>

                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[var(--color-textPrimary)] truncate">
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-sm text-[var(--color-textSecondary)] line-clamp-2 mt-1">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-[var(--color-textSecondary)]">
                          Cantidad: {item.quantity}
                        </span>
                        <span className="font-semibold text-[var(--color-textPrimary)]">
                          {formatPrice(item.amount_total, session.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-[var(--color-border)] pt-4 space-y-3">
                <div className="flex justify-between text-[var(--color-textSecondary)]">
                  <span>Subtotal</span>
                  <span>{formatPrice(session.amount_subtotal, session.currency)}</span>
                </div>

                {session.amount_tax > 0 && (
                  <div className="flex justify-between text-[var(--color-textSecondary)]">
                    <span>Impuestos</span>
                    <span>{formatPrice(session.amount_tax, session.currency)}</span>
                  </div>
                )}

                <div className="flex justify-between text-lg font-bold text-[var(--color-textPrimary)] pt-3 border-t border-[var(--color-border)]">
                  <span>Total</span>
                  <span>{formatPrice(session.amount_total, session.currency)}</span>
                </div>
              </div>

              {/* Merchant info */}
              {session.merchant.support_email && (
                <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
                  <p className="text-sm text-[var(--color-textSecondary)]">
                    ¿Tienes preguntas? Contáctanos en{' '}
                    <a
                      href={`mailto:${session.merchant.support_email}`}
                      className="text-[var(--color-primary)] hover:underline font-medium"
                    >
                      {session.merchant.support_email}
                    </a>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
