import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import LoginForm from './LoginForm'
import { Shield } from 'lucide-react'

export default async function LoginPage() {
  const supabase = await createClient()
  
  // Check if user is already authenticated
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect('/dashboard')
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <Shield className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">DeonPay Hub</h1>
          <p className="text-indigo-100">Internal Administration System</p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-semibold text-white mb-6 text-center">
            Sign In
          </h2>
          
          <LoginForm />
          
          {/* Info notice */}
          <div className="mt-6 p-4 bg-white/10 rounded-lg border border-white/20">
            <p className="text-sm text-white/90 text-center">
              This is a restricted area. Access is by invitation only.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/70 text-sm mt-8">
          © 2024 DeonPay. All rights reserved.
        </p>
      </div>
    </div>
  )
}
