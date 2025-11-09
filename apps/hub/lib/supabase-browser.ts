import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr'

export type Database = {
  public: {
    Tables: {
      merchants: {
        Row: {
          id: string
          owner_user_id: string
          name: string
          status: string
          onboarding_stage: string
          country: string
          currency: string
          channel: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_user_id: string
          name: string
          status?: string
          onboarding_stage?: string
          country?: string
          currency?: string
          channel?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_user_id?: string
          name?: string
          status?: string
          onboarding_stage?: string
          country?: string
          currency?: string
          channel?: string
          created_at?: string
          updated_at?: string
        }
      }
      users_profile: {
        Row: {
          user_id: string
          full_name: string
          phone: string
          profile_type: string
          default_merchant_id: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          full_name: string
          phone: string
          profile_type: string
          default_merchant_id?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          full_name?: string
          phone?: string
          profile_type?: string
          default_merchant_id?: string | null
          created_at?: string
        }
      }
    }
  }
}

// Client-side Supabase client for use in Client Components
// Uses default cookie storage which works with httpOnly cookies from server
export function createBrowserClient() {
  return createSupabaseBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Try to read from document.cookie (works for non-httpOnly cookies)
          if (typeof document !== 'undefined') {
            const cookies = document.cookie.split(';')

            // First try to read the client-accessible version
            for (const cookie of cookies) {
              const [key, value] = cookie.trim().split('=')
              if (key === `${name}-client`) {
                return decodeURIComponent(value)
              }
            }
            // Fallback to original name
            for (const cookie of cookies) {
              const [key, value] = cookie.trim().split('=')
              if (key === name) {
                return decodeURIComponent(value)
              }
            }
          }
          return null
        },
        set(name: string, value: string, options: any) {
          // Set cookie accessible from browser (without httpOnly)
          if (typeof document !== 'undefined') {
            let cookieString = `${name}=${encodeURIComponent(value)}`

            if (options?.maxAge) {
              cookieString += `; max-age=${options.maxAge}`
            }
            if (options?.path) {
              cookieString += `; path=${options.path}`
            } else {
              cookieString += '; path=/'
            }

            // Share cookies across subdomains
            cookieString += '; domain=.deonpay.mx'

            if (options?.sameSite) {
              cookieString += `; samesite=${options.sameSite}`
            } else {
              cookieString += '; samesite=lax'
            }

            if (options?.secure !== false) {
              cookieString += '; secure'
            }

            document.cookie = cookieString
          }
        },
        remove(name: string, options: any) {
          // Remove cookie by setting expired date
          if (typeof document !== 'undefined') {
            let cookieString = `${name}=; max-age=0; path=/`
            cookieString += '; domain=.deonpay.mx'
            document.cookie = cookieString
          }
        },
      },
    }
  )
}
