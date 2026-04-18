'use client'

import { createContext, useContext, useState, useCallback } from 'react'

const DISMISS_KEY = 'ocupa-auth-dismissed'
const DISMISS_TTL = 24 * 60 * 60 * 1000 // 24h in ms

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const { at } = JSON.parse(raw) as { at: number }
    return Date.now() - at < DISMISS_TTL
  } catch {
    return false
  }
}

interface AuthModalContextType {
  isOpen: boolean
  openAuthModal: () => void
  closeAuthModal: (dismissed?: boolean) => void
}

const AuthModalContext = createContext<AuthModalContextType>({
  isOpen: false,
  openAuthModal: () => {},
  closeAuthModal: () => {},
})

export function useAuthModal() {
  return useContext(AuthModalContext)
}

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openAuthModal = useCallback(() => {
    if (wasDismissedRecently()) return
    setIsOpen(true)
  }, [])

  const closeAuthModal = useCallback((dismissed = false) => {
    if (dismissed) {
      try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify({ at: Date.now() }))
      } catch {}
    }
    setIsOpen(false)
  }, [])

  return (
    <AuthModalContext.Provider value={{ isOpen, openAuthModal, closeAuthModal }}>
      {children}
    </AuthModalContext.Provider>
  )
}
