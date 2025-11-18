import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-2xl w-full mx-auto px-6 py-12 text-center">
        {/* Logo/Brand */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            DeonPay
          </h1>
          <p className="text-xl text-gray-600">
            Enlaces de Pago Seguros
          </p>
        </div>

        {/* Main Message */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="mb-6">
            <svg
              className="w-16 h-16 mx-auto text-blue-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Esta es la plataforma de enlaces de pago de DeonPay
          </h2>

          <p className="text-gray-600 mb-6 leading-relaxed">
            Esta página solo carga cuando accedes a un enlace de pago válido con un producto asociado.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>¿Cómo funciona?</strong><br />
              Los comerciantes crean enlaces de pago desde su dashboard. Cuando compartes un enlace válido,
              se carga automáticamente la pantalla de checkout para completar el pago.
            </p>
          </div>

          {/* URL Example */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-500 mb-2">Ejemplo de enlace válido:</p>
            <code className="text-sm text-gray-800 font-mono break-all">
              link.deonpay.mx/producto-ejemplo
            </code>
            <p className="text-xs text-gray-500 mt-2">o</p>
            <code className="text-sm text-gray-800 font-mono break-all">
              link.deonpay.mx/550e8400-e29b-41d4-a716-446655440000
            </code>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-4">
          <Link
            href="https://dashboard.deonpay.mx"
            className="inline-block px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            Ir al Dashboard
          </Link>

          <p className="text-sm text-gray-500">
            ¿Eres comerciante?{' '}
            <Link href="https://deonpay.mx" className="text-blue-600 hover:text-blue-700 underline">
              Conoce más sobre DeonPay
            </Link>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} DeonPay. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}
