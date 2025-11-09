import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export type Database = {
  public: {
    Tables: {
      merchants: {
        Row: {
          id: string
          owner_user_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_user_id?: string
          name?: string
          created_at?: string
        }
      }
      users_profile: {
        Row: {
          user_id: string
          default_merchant_id: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          default_merchant_id?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          default_merchant_id?: string | null
          created_at?: string
        }
      }
      merchant_members: {
        Row: {
          id: string
          merchant_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          created_at: string
        }
        Insert: {
          id?: string
          merchant_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member'
          created_at?: string
        }
        Update: {
          id?: string
          merchant_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          created_at?: string
        }
      }
    }
  }
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                domain: process.env.SUPABASE_COOKIE_DOMAIN || '.deonpay.mx',
                secure: true,
                httpOnly: true,
                sameSite: 'lax',
              })
            })
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export type SupabaseClient = ReturnType<typeof createClient>

/**
 * Verifica si un usuario tiene acceso a un merchant
 * @param userId - ID del usuario
 * @param merchantId - ID del merchant
 * @returns true si el usuario es owner o miembro del merchant
 */
export async function hasAccessToMerchant(
  userId: string,
  merchantId: string
): Promise<boolean> {
  const supabase = await createClient()

  // Verificar si es owner del merchant
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('owner_user_id')
    .eq('id', merchantId)
    .single()

  if (merchantError || !merchant) {
    return false
  }

  // Si es owner, tiene acceso
  if (merchant.owner_user_id === userId) {
    return true
  }

  // TODO: Verificar si es miembro (merchant_members table)
  // const { data: member } = await supabase
  //   .from('merchant_members')
  //   .select('id')
  //   .eq('merchant_id', merchantId)
  //   .eq('user_id', userId)
  //   .single()
  //
  // return !!member

  return false
}
