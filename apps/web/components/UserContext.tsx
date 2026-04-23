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

    async function fetchAndSetUser(supabaseUser: User) {
      const { data } = await supabase
        .from('profiles')
        .select('is_pro')
        .eq('id', supabaseUser.id)
        .single()
      setUser(deriveFromSupabase(supabaseUser, data?.is_pro ?? false))
    }

    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) await fetchAndSetUser(session.user)
      setLoading(false)
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          await fetchAndSetUser(session.user)
        } else {
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
