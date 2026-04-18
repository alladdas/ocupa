'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface UpgradeModalContextType {
  isOpen: boolean
  openUpgradeModal: () => void
  closeUpgradeModal: () => void
}

const UpgradeModalContext = createContext<UpgradeModalContextType>({
  isOpen: false,
  openUpgradeModal: () => {},
  closeUpgradeModal: () => {},
})

export function useUpgradeModal() {
  return useContext(UpgradeModalContext)
}

export function UpgradeModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const openUpgradeModal = useCallback(() => setIsOpen(true), [])
  const closeUpgradeModal = useCallback(() => setIsOpen(false), [])

  return (
    <UpgradeModalContext.Provider value={{ isOpen, openUpgradeModal, closeUpgradeModal }}>
      {children}
    </UpgradeModalContext.Provider>
  )
}
