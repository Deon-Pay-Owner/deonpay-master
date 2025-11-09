import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import HubHeader from '@/components/HubHeader'
import HubSidebar from '@/components/HubSidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }
  
  // Get hub user info
  const { data: hubUser } = await supabase
    .from('hub_users')
    .select('id, email, full_name, role, is_active')
    .eq('email', user.email)
    .single()
  
  if (!hubUser || !hubUser.is_active) {
    redirect('/login')
  }
  
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <HubHeader user={hubUser} />
      <div className="flex">
        <HubSidebar role={hubUser.role} />
        <main className="flex-1 ml-64">
          {children}
        </main>
      </div>
    </div>
  )
}
