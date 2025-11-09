import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default async function HomePage() {
  const supabase = await createClient()
  
  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }
  
  // If authenticated, redirect to dashboard
  redirect('/dashboard')
}
