'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/', label: 'Vagas' },
  { href: '/pricing', label: 'Planos' },
  { href: '/roast', label: 'Roast do CV' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600">
            <Zap className="h-4 w-4 text-white" />
          </span>
          <span className="text-lg tracking-tight">
            ocupa
            <span className="text-violet-400">.</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors',
                pathname === link.href
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-zinc-100'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/onboarding"
            className="text-sm font-medium text-zinc-400 transition-colors hover:text-white"
          >
            Entrar
          </Link>
          <Link
            href="/onboarding"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
          >
            Criar alerta grátis
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-zinc-800 bg-zinc-950 px-4 pb-4 pt-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  pathname === link.href
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-zinc-800 pt-3">
            <Link
              href="/onboarding"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2.5 text-center text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              Entrar
            </Link>
            <Link
              href="/onboarding"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg bg-violet-600 px-3 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-violet-500"
            >
              Criar alerta grátis
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
