import { createClient } from '@/lib/supabase'
import { Building2, ExternalLink, Search } from 'lucide-react'
import Link from 'next/link'

export default async function MerchantsPage() {
  const supabase = await createClient()

  const { data: merchants, error } = await supabase
    .from('merchants')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error loading merchants:', error)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      active: {
        label: 'Active',
        className: 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
      },
      pending: {
        label: 'Pending',
        className: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]',
      },
      suspended: {
        label: 'Suspended',
        className: 'bg-[var(--color-error)]/20 text-[var(--color-error)]',
      },
    }

    const config = statusConfig[status] || statusConfig.pending

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
      >
        {config.label}
      </span>
    )
  }

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date))
  }

  return (
    <div className="container-hub pt-8 pb-4 sm:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-textPrimary)] mb-2">
            Merchants
          </h1>
          <p className="text-[var(--color-textSecondary)]">
            Manage all merchant accounts
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-textSecondary)] pointer-events-none z-10"
          />
          <input
            type="text"
            placeholder="Search merchants by name, email, ID..."
            className="input-field pl-11 w-full"
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
      </div>

      {/* Merchants Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--color-textPrimary)]">
                  Merchant
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--color-textPrimary)] hidden md:table-cell">
                  Owner
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--color-textPrimary)] hidden md:table-cell">
                  Created
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--color-textPrimary)]">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--color-textPrimary)] hidden lg:table-cell">
                  Acquirer
                </th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-[var(--color-textPrimary)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {merchants && merchants.length > 0 ? (
                merchants.map((merchant) => (
                  <tr
                    key={merchant.id}
                    className="border-b border-[var(--color-border)] hover:bg-[var(--color-primary)]/5 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-textPrimary)]">
                          {merchant.name}
                        </p>
                        <p className="text-xs text-[var(--color-textSecondary)] font-mono">
                          {merchant.id.substring(0, 8)}...
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-[var(--color-textSecondary)] hidden md:table-cell">
                      {merchant.owner_user_id?.substring(0, 8)}...
                    </td>
                    <td className="py-3 px-4 text-sm text-[var(--color-textSecondary)] hidden md:table-cell">
                      {formatDate(merchant.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(merchant.status || 'pending')}
                    </td>
                    <td className="py-3 px-4 text-sm text-[var(--color-textSecondary)] hidden lg:table-cell">
                      {merchant.routing_config?.defaultAdapter || 'mock'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/dashboard/merchants/${merchant.id}`}
                        className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
                      >
                        View
                        <ExternalLink size={14} />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Building2
                      size={48}
                      className="mx-auto mb-4 text-[var(--color-border)]"
                    />
                    <p className="text-[var(--color-textSecondary)] font-medium mb-2">
                      No merchants found
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
