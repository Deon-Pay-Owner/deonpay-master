import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          DeonPay API v1.0
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Multi-acquirer payment processing API with Stripe-compatible interface.
          Built on Cloudflare Workers for global low-latency.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <Link
          href="/migration"
          className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
        >
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            Migration Guide →
          </h2>
          <p className="text-gray-600">
            Step-by-step guide to migrate from Stripe or custom payment implementations
            to DeonPay API.
          </p>
        </Link>

        <Link
          href="/release-notes"
          className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
        >
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            Release Notes →
          </h2>
          <p className="text-gray-600">
            What's new in v1.0, breaking changes, migration paths, and known issues.
          </p>
        </Link>

        <Link
          href="/api"
          className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
        >
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            API Reference →
          </h2>
          <p className="text-gray-600">
            Complete OpenAPI 3.1 specification with all endpoints, schemas, and examples.
          </p>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Quick Start</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">1. Install the SDK</h3>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
              <code>npm install @deonpay/sdk</code>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">2. Initialize the client</h3>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
              <pre><code>{`import { DeonPay } from '@deonpay/sdk'

const deonpay = new DeonPay({
  apiKey: 'sk_test_...',
  version: '2025-01-01',
})`}</code></pre>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">3. Create a payment</h3>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
              <pre><code>{`const paymentIntent = await deonpay.paymentIntents.create({
  amount: 5000,
  currency: 'mxn',
})

const confirmed = await deonpay.paymentIntents.confirm(paymentIntent.id, {
  payment_method: {
    type: 'card',
    card: {
      number: '4242424242424242',
      exp_month: 12,
      exp_year: 2025,
      cvv: '123',
    },
  },
})

console.log(confirmed.status) // 'succeeded'`}</code></pre>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-16">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Core Features</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Multi-Acquirer Support
            </h3>
            <p className="text-gray-600">
              Route payments through multiple processors (CyberSource, Mock) with
              extensible adapter architecture.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Stripe-Compatible
            </h3>
            <p className="text-gray-600">
              Drop-in replacement for Stripe API with familiar endpoints and data structures.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Global Low-Latency
            </h3>
            <p className="text-gray-600">
              Built on Cloudflare Workers for edge computing and worldwide low latency.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Type-Safe & Tested
            </h3>
            <p className="text-gray-600">
              Full TypeScript support with 159+ tests and comprehensive type safety.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
