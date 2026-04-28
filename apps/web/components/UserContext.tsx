'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

export interface OcupaUser {
  id: string
  email: string
  name: string
  initials: string
  avatarUrl: string | null
  isPro: boolean
}

function deriveFromSupabase(supabaseUser: User, isPro: boolean): OcupaUser {
  const email = supabaseUser.email ?? ''
  const meta = supabaseUser.user_metadata ?? {}
  const fullName: string = meta.full_name ?? meta.name ?? ''
  const avatarUrl: string | null = meta.avatar_url ?? null

  let name = fullName
  let initials = ''

  if (name) {
    const parts = name.trim().split(/\s+/)
    initials = parts.slice(0, 2).map((p: string) => p.charAt(0).toUpperCase()).join('')
  } else {
    const local = email.split('@')[0]
    const parts = local.split(/[._\-+]/).filter(Boolean)
    name = parts
      .slice(0, 2)
      .map((p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(' ')
    initials = parts
      .slice(0, 2)
      .map((p: string) => p.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2)
  }

  return {
    id: supabaseUser.id,
    email,
    name: name || email,
    initials: initials || email.slice(0, 2).toUpperCase(),
    avatarUrl,
    isPro,
  }
}

interface UserContextType {
  user: OcupaUser | null
  loading: boolean
  logout: () => Promise<void>
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  logout: async () => {},
})

export function useUser() {
  return useContext(UserContext)
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<OcupaUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseBrowser()

    // Enrich with is_pro from profiles table in the background.
    // setUser is already called with isPro=false before this runs.
    function enrichWithProfile(supabaseUser: User) {
      supabase
        .from('profiles')
        .select('is_pro')
        .eq('id', supabaseUser.id)
        .single()
        .then(({ data }: { data: { is_pro: boolean } | null }) => {
          if (data?.is_pro) {
            setUser(prev => prev ? { ...prev, isPro: true } : prev)
          }
        })
        .catch(() => {/* profiles table missing or RLS blocked — isPro stays false */})
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          if (session?.user) {
            // Set user immediately from auth data — no awaiting a DB query
            setUser(deriveFromSupabase(session.user, false))
            enrichWithProfile(session.user)
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const logout = async () => {
    await getSupabaseBrowser().auth.signOut()
    setUser(null)
  }

  return (
    <UserContext.Provider value={{ user, loading, logout }}>
      {children}
    </UserContext.Provider>
  )
}
