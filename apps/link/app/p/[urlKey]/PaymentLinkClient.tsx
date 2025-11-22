'use client'

import { useState, useEffect, useRef } from 'react'

interface PaymentLinkClientProps {
  paymentLink: any
}

export default function PaymentLinkClient({ paymentLink }: PaymentLinkClientProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [customerAmount, setCustomerAmount] = useState('')

  // Form data
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  // Extract metadata
  const metadata = paymentLink.metadata || {}
  const mode = metadata.mode || 'fixed_amount'
  const publicDescription = metadata.public_description || paymentLink.after_completion_message || ''
  const collectEmail = metadata.collect_email !== false // Default true
  const collectName = metadata.collect_name !== false // Default true
  const collectPhone = paymentLink.phone_number_collection || false

  // Calculate display amount
  let displayAmount = 0
  if (paymentLink.line_items && paymentLink.line_items.length > 0) {
    // Has products - calculate from line items
    displayAmount = paymentLink.line_items.reduce((sum: number, item: any) => {
      const unitAmount = item.price_data?.unit_amount || 0
      const quantity = item.quantity || 1
      return sum + (unitAmount * quantity)
    }, 0)
  } else if (metadata.amount) {
    // Amount-only link
    displayAmount = metadata.amount
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validate required fields
      if (collectEmail && !email) {
        throw new Error('Email es requerido')
      }
      if (collectName && !name) {
        throw new Error('Nombre es requerido')
      }
      if (collectPhone && !phone) {
        throw new Error('Teléfono es requerido')
      }

      // Validate amount for customer_chooses mode
      let amountInCents: number | undefined
      if (mode === 'customer_chooses') {
        const parsedAmount = parseFloat(customerAmount)
        if (!parsedAmount || parsedAmount <= 0) {
          throw new Error('Por favor ingresa un monto válido')
        }
        amountInCents = Math.round(parsedAmount * 100)
      }

      // Call BFF endpoint to create payment_intent
      const response = await fetch('/api/checkout/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          urlKey: paymentLink.url_key,
          email: collectEmail ? email : undefined,
          name: collectName ? name : undefined,
          phone: collectPhone ? phone : undefined,
          amount: amountInCents
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Error al crear el pago')
      }

      const data = await response.json()

      // Set client secret and public key for DeonPay Elements
      setClientSecret(data.clientSecret)
      setPublicKey(data.publicKey)

      // NOTE: In a full implementation, we would now:
      // 1. Load @deonpay/elements-sdk
      // 2. Initialize DeonPay Elements with publicKey
      // 3. Render payment form
      // 4. Collect card details
      // 5. Confirm payment with clientSecret
      // 6. Handle success/error

      // For now, show success message
      // This will be completed when integrating the full SDK
      setSuccess(true)

    } catch (err: any) {
      setError(err.message || 'Error al procesar el pago')
    } finally {
      setLoading(false)
    }
  }

  // Redirect to success URL if payment succeeded
  if (success && metadata.success_url) {
    if (typeof window !== 'undefined') {
      window.location.href = metadata.success_url
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {/* Success State */}
        {success && !metadata.success_url && (
          <div className="text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-16 w-16 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              ¡Pago Iniciado!
            </h2>
            <p className="text-gray-600">
              {paymentLink.after_completion_message || 'Tu pago ha sido procesado exitosamente'}
            </p>
            {clientSecret && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Payment Intent creado. Integrando con @deonpay/elements-sdk próximamente.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Payment Form */}
        {!success && (
          <>
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {metadata.internal_name || 'Pago'}
              </h1>
              {publicDescription && (
                <p className="text-gray-600">{publicDescription}</p>
              )}
            </div>

            {/* Amount Display */}
            <div className="bg-gray-100 rounded-lg p-6 mb-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Monto a pagar</p>
                {mode === 'fixed_amount' ? (
                  <p className="text-3xl font-bold text-gray-900">
                    ${(displayAmount / 100).toFixed(2)} {paymentLink.currency || 'MXN'}
                  </p>
                ) : (
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={customerAmount}
                    onChange={(e) => setCustomerAmount(e.target.value)}
                    placeholder="Ingresa el monto"
                    className="text-3xl font-bold text-gray-900 bg-transparent text-center border-b-2 border-blue-500 focus:outline-none w-full"
                    required
                  />
                )}
              </div>
            </div>

            {/* Payment Form */}
            <form onSubmit={handleSubmit}>
              {/* Customer Information */}
              <div className="space-y-4 mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Información de contacto</h2>

                {collectEmail && (
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="tu@email.com"
                    />
                  </div>
                )}

                {collectName && (
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre completo *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Juan Pérez"
                    />
                  </div>
                )}

                {collectPhone && (
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required={collectPhone}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+52 123 456 7890"
                    />
                  </div>
                )}
              </div>

              {/* Payment Method Placeholder */}
              {!clientSecret && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Información de pago</h2>
                  <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-600">
                    <p className="text-sm">
                      El pago se procesará al hacer clic en &quot;Continuar&quot;
                    </p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
              >
                {loading ? 'Procesando...' : 'Continuar'}
              </button>
            </form>

            {/* Footer */}
            <div className="mt-6 text-center text-xs text-gray-500">
              <p>Pago seguro procesado por DeonPay</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
