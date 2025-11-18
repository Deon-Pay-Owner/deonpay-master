import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center px-6">
        <div className="mb-8">
          <div className="text-6xl font-bold text-gray-900 mb-2">404</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Link No Encontrado
          </h1>
          <p className="text-gray-600">
            El link de pago que buscas no existe o ha sido desactivado.
          </p>
        </div>

        <div className="space-y-3">
          <div className="text-sm text-gray-500">
            Posibles razones:
          </div>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• El link ha expirado o fue desactivado</li>
            <li>• La URL es incorrecta</li>
            <li>• El producto ya no está disponible</li>
          </ul>
        </div>

        <div className="mt-8">
          <Link
            href="https://deonpay.mx"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ir a DeonPay
          </Link>
        </div>
      </div>
    </div>
  )
}
