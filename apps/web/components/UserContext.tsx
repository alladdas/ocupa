'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const USER_KEY = 'ocupa-user'

export interface OcupaUser {
  email: string
  name: string
  initials: string
}

function deriveUser(email: string): OcupaUser {
  const local = email.split('@')[0]
  const parts = local.split(/[._\-+]/).filter(Boolean)
  const name = parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ')
  const initials = parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2)
  return {
    email,
    name: name || local,
    initials: initials || local.slice(0, 2).toUpperCase(),
  }
}

interface UserContextType {
  user: OcupaUser | null
  login: (email: string) => void
  logout: () => void
}

const UserContext = createContext<UserContextType>({
  user: null,
  login: () => {},
  logout: () => {},
})

export function useUser() {
  return useContext(UserContext)
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<OcupaUser | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      if (raw) setUser(JSON.parse(raw))
    } catch {}
  }, [])

  const login = (email: string) => {
    const u = deriveUser(email)
    setUser(u)
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(u))
    } catch {}
  }

  const logout = () => {
    setUser(null)
    try {
      localStorage.removeItem(USER_KEY)
    } catch {}
  }

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  )
}
