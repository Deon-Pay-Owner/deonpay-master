'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Building2, Settings, BarChart3, Key } from 'lucide-react'

export default function HubSidebar({ role }: { role: string }) {
  const pathname = usePathname()

  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Dashboard' },
    { href: '/dashboard/merchants', icon: Building2, label: 'Merchants' },
    { href: '/dashboard/organizations', icon: Users, label: 'Organizations' },
    { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics', adminOnly: true },
    { href: '/dashboard/users', icon: Key, label: 'Hub Users', superAdminOnly: true },
    { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
  ]

  const canAccess = (item: any) => {
    if (item.superAdminOnly && role !== 'super_admin') return false
    if (item.adminOnly && !['super_admin', 'admin'].includes(role)) return false
    return true
  }

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-[var(--color-surface)] border-r border-[var(--color-border)] overflow-y-auto">
      <nav className="p-4 space-y-1">
        {navItems.filter(canAccess).map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-background)] hover:text-[var(--color-textPrimary)]'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
