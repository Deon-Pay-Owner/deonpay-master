import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeonPay API Documentation",
  description: "Multi-acquirer payment processing API with Stripe-compatible interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <a href="/" className="text-2xl font-bold text-blue-600">
                  DeonPay
                </a>
                <span className="ml-2 text-sm text-gray-500">API Documentation</span>
              </div>
              <div className="flex items-center space-x-4">
                <a href="/migration" className="text-gray-700 hover:text-blue-600">
                  Migration Guide
                </a>
                <a href="/release-notes" className="text-gray-700 hover:text-blue-600">
                  Release Notes
                </a>
                <a href="/api" className="text-gray-700 hover:text-blue-600">
                  API Reference
                </a>
              </div>
            </div>
          </div>
        </nav>
        <main>{children}</main>
        <footer className="bg-white border-t mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center text-gray-500 text-sm">
              © 2025 DeonPay. All rights reserved.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
