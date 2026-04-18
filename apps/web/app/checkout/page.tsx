'use client'

import { useRouter } from 'next/navigation'
import { Zap, Lock } from 'lucide-react'
import Link from 'next/link'

export default function CheckoutPage() {
  const router = useRouter()

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--d-bg)' }}>
      {/* Header */}
      <header
        className="flex h-14 flex-shrink-0 items-center justify-between border-b px-6"
        style={{ background: 'var(--d-nav)', borderColor: 'var(--d-border)' }}
      >
        <Link href="/" className="flex items-center gap-1.5">
          <Zap className="h-4 w-4" style={{ color: 'var(--d-accent)', fill: 'var(--d-accent)' }} />
          <span className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--d-text)' }}>
            ocupa.
          </span>
        </Link>
        <Lock className="h-4 w-4" style={{ color: 'var(--d-muted)' }} />
      </header>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div
          className="w-full max-w-md rounded-2xl border p-8 text-center"
          style={{ background: 'white', borderColor: '#e8ebe9' }}
        >
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: 'rgba(47,141,106,0.1)' }}
          >
            <Lock className="h-6 w-6" style={{ color: '#2f8d6a' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#1d161d', letterSpacing: '-0.3px' }}>
            Checkout via Stripe
          </h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: '#a89ea8' }}>
            Integração Stripe será conectada aqui. R$14,90/semana · Cancele a qualquer momento.
          </p>
          <button
            onClick={() => router.push('/')}
            className="font-mono-dm mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
            style={{ background: '#1d161d' }}
          >
            Voltar ao início
          </button>
        </div>
      </div>
    </div>
  )
}
