'use client'

import { AuthModalProvider } from '@/components/AuthModalContext'
import { UpgradeModalProvider } from '@/components/UpgradeModalContext'
import AuthModal from '@/components/AuthModal'
import UpgradeModal from '@/components/UpgradeModal'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthModalProvider>
      <UpgradeModalProvider>
        {children}
        <AuthModal />
        <UpgradeModal />
      </UpgradeModalProvider>
    </AuthModalProvider>
  )
}
