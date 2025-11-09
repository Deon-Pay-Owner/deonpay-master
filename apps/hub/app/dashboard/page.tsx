import { createClient } from '@/lib/supabase'
import { Users, Building2, DollarSign, Activity } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Get stats
  const { count: merchantsCount } = await supabase
    .from('merchants')
    .select('*', { count: 'exact', head: true })
  
  const { count: activeCount } = await supabase
    .from('merchants')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
  
  const { count: sandboxCount } = await supabase
    .from('merchants')
    .select('*', { count: 'exact', head: true })
    .eq('onboarding_stage', 'sandbox')
  
  const { count: hubUsersCount } = await supabase
    .from('hub_users')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
  
  return (
    <div className="container-hub pt-8 pb-4 sm:py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--color-textPrimary)] mb-2">
          Dashboard Overview
        </h1>
        <p className="text-[var(--color-textSecondary)]">
          Welcome to DeonPay Hub - Internal Administration
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-textSecondary)] mb-1">
                Total Merchants
              </p>
              <p className="text-3xl font-bold text-[var(--color-textPrimary)]">
                {merchantsCount || 0}
              </p>
            </div>
            <div className="p-3 bg-[var(--color-primary)]/10 rounded-lg">
              <Building2 className="w-8 h-8 text-[var(--color-primary)]" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-textSecondary)] mb-1">
                Active Merchants
              </p>
              <p className="text-3xl font-bold text-[var(--color-success)]">
                {activeCount || 0}
              </p>
            </div>
            <div className="p-3 bg-[var(--color-success)]/10 rounded-lg">
              <Activity className="w-8 h-8 text-[var(--color-success)]" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-textSecondary)] mb-1">
                Sandbox Mode
              </p>
              <p className="text-3xl font-bold text-[var(--color-warning)]">
                {sandboxCount || 0}
              </p>
            </div>
            <div className="p-3 bg-[var(--color-warning)]/10 rounded-lg">
              <DollarSign className="w-8 h-8 text-[var(--color-warning)]" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-textSecondary)] mb-1">
                Hub Users
              </p>
              <p className="text-3xl font-bold text-[var(--color-info)]">
                {hubUsersCount || 0}
              </p>
            </div>
            <div className="p-3 bg-[var(--color-info)]/10 rounded-lg">
              <Users className="w-8 h-8 text-[var(--color-info)]" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="card">
        <h2 className="card-header">Recent Activity</h2>
        <p className="text-[var(--color-textSecondary)] text-center py-8">
          Activity feed will be implemented in the next session
        </p>
      </div>
    </div>
  )
}
