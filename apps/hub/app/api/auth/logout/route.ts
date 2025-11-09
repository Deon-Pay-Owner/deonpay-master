import { createClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Update session log
      await supabase
        .from('session_logs')
        .update({
          logout_at: new Date().toISOString(),
          is_active: false,
        })
        .eq('user_id', user.id)
        .is('logout_at', null)
    }
    
    // Sign out
    await supabase.auth.signOut()
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'An error occurred during logout' },
      { status: 500 }
    )
  }
}
