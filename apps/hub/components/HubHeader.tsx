'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, LogOut, User, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface HubUser {
  id: string
  email: string
  full_name: string | null
  role: string
  is_active: boolean
}

export default function HubHeader({ user }: { user: HubUser }) {
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const [showDropdown, setShowDropdown] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const getRoleLabel = (role: string) => {
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  return (
    <header className="glass sticky top-0 z-30 h-16 px-6 flex items-center justify-between border-b border-[var(--color-border)]">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-[var(--color-primary)]" />
        <div>
          <h1 className="text-lg font-bold text-[var(--color-textPrimary)]">DeonPay Hub</h1>
          <p className="text-xs text-[var(--color-textSecondary)]">Internal Admin</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="p-2 hover:bg-[var(--color-surface)] rounded-lg transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-[var(--color-textSecondary)]" />
          ) : (
            <Moon className="w-5 h-5 text-[var(--color-textSecondary)]" />
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-surface)] rounded-lg transition-colors"
          >
            <div className="text-right">
              <p className="text-sm font-medium text-[var(--color-textPrimary)]">
                {user.full_name || user.email}
              </p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                {getRoleLabel(user.role)}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
          </button>

          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-20">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-sm text-[var(--color-danger)] hover:bg-[var(--color-background)] flex items-center gap-2 rounded-lg"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
