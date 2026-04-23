'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Zap, Sun, Moon, LogOut } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { useUser } from '@/components/UserContext'
import { useUpgradeModal } from '@/components/UpgradeModalContext'

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <button
      onClick={toggleTheme}
      className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10"
      style={{ color: 'var(--d-muted)' }}
      title={mounted ? (theme === 'dark' ? 'Modo claro' : 'Modo escuro') : 'Alternar tema'}
    >
      {mounted ? (
        theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
      ) : (
        <div className="h-4 w-4" />
      )}
    </button>
  )
}

function UserAvatar() {
  const { user, logout } = useUser()
  const [open, setOpen] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = () => setOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  if (!user) return null

  const showPhoto = !!user.avatarUrl && !imgFailed

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full transition-opacity hover:opacity-90"
        style={showPhoto ? undefined : { background: 'var(--d-accent)' }}
        title={user.email}
      >
        {showPhoto ? (
          <Image
            src={user.avatarUrl!}
            alt={user.name}
            width={28}
            height={28}
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="text-xs font-bold text-white">{user.initials}</span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-9 z-20 min-w-[200px] overflow-hidden rounded-xl border py-1 shadow-lg"
          style={{ background: 'var(--d-nav)', borderColor: 'var(--d-border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--d-border)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--d-text)' }}>
              {user.name}
            </p>
            <p
              className="font-mono-dm mt-0.5 truncate text-[11px]"
              style={{ color: 'var(--d-muted)' }}
            >
              {user.email}
            </p>
            {user.isPro && (
              <span
                className="font-mono-dm mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{ background: 'var(--d-accent-subtle)', color: 'var(--d-accent-text)' }}
              >
                <Zap className="h-2.5 w-2.5 fill-current" />
                Pro
              </span>
            )}
          </div>
          <button
            onClick={() => { logout(); setOpen(false) }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--d-text-2)' }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      )}
    </div>
  )
}

export default function DashNav() {
  const { user } = useUser()
  const { openUpgradeModal } = useUpgradeModal()

  return (
    <nav
      className="flex h-12 flex-shrink-0 items-center justify-between border-b px-5"
      style={{ background: 'var(--d-nav)', borderColor: 'var(--d-border)' }}
    >
      <Link href="/" className="flex items-center gap-1.5">
        <Zap
          className="h-4 w-4"
          style={{ color: 'var(--d-accent)', fill: 'var(--d-accent)' }}
        />
        <span className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--d-text)' }}>
          ocupa.
        </span>
      </Link>

      <div className="flex items-center gap-2">
        <Link
          href="/pricing"
          className="hidden text-sm transition-colors hover:opacity-80 sm:block"
          style={{ color: 'var(--d-text-2)' }}
        >
          Planos
        </Link>

        <ThemeToggle />

        {!user && (
          <Link
            href="/pricing"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--d-accent)' }}
          >
            <Zap className="h-3 w-3 fill-white text-white" />
            Criar conta
          </Link>
        )}

        {/* Show Upgrade only when logged in and not yet Pro */}
        {user && !user.isPro && (
          <button
            onClick={openUpgradeModal}
            className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 sm:flex"
            style={{ background: 'var(--d-accent)', border: 'none', cursor: 'pointer' }}
          >
            <Zap className="h-3 w-3 fill-white text-white" />
            Upgrade Pro
          </button>
        )}

        <UserAvatar />
      </div>
    </nav>
  )
}
