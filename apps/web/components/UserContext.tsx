'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { useRouter, usePathname } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

export interface OcupaUser {
  id: string
  email: string
  name: string
  initials: string
  avatarUrl: string | null
  isPro: boolean
  atsProfileId: number | null
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
    atsProfileId: null,
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
  const router = useRouter()
  const pathname = usePathname()

  // Refs so async callbacks never capture stale values
  const routerRef = useRef(router)
  const pathnameRef = useRef(pathname)
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => { routerRef.current = router }, [router])
  useEffect(() => { pathnameRef.current = pathname }, [pathname])

  useEffect(() => {
    const supabase = getSupabaseBrowser()

    function enrichWithProfile(supabaseUser: User) {
      const uid = supabaseUser.id
      currentUserIdRef.current = uid

      supabase
        .from('profiles')
        .select('is_pro, ats_profile_id, onboarding_completed')
        .eq('id', uid)
        .single()
        .then(({ data }: { data: { is_pro: boolean; ats_profile_id: number | null; onboarding_completed: boolean | null } | null }) => {
          if (currentUserIdRef.current !== uid) return  // user switched account mid-flight

          setUser(prev => prev ? {
            ...prev,
            isPro: data?.is_pro ?? prev.isPro,
            atsProfileId: data?.ats_profile_id ?? null,
          } : prev)

          if (!data?.onboarding_completed && pathnameRef.current !== '/get-started') {
            routerRef.current.push('/get-started')
          }
        })
        .catch(() => {/* profiles table missing or RLS blocked — no redirect */})
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          if (session?.user) {
            setUser(deriveFromSupabase(session.user, false))
            enrichWithProfile(session.user)
          }
        } else if (event === 'SIGNED_OUT') {
          currentUserIdRef.current = null
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const logout = async () => {
    currentUserIdRef.current = null
    await getSupabaseBrowser().auth.signOut()
    setUser(null)
  }

  return (
    <UserContext.Provider value={{ user, loading, logout }}>
      {children}
    </UserContext.Provider>
  )
}
