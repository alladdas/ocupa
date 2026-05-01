'use client'

import { useState, useEffect } from 'react'
import { X, CheckCircle, Zap, Loader2 } from 'lucide-react'
import { useUpgradeModal } from '@/components/UpgradeModalContext'
import { useUser } from '@/components/UserContext'
import { useAuthModal } from '@/components/AuthModalContext'

const BULLETS = [
  'Aplica automaticamente assim que a vaga abre',
  'Um clique e seu currículo é enviado',
  'Acompanhe todas as candidaturas em um lugar',
]

export default function UpgradeModal() {
  const { isOpen, closeUpgradeModal } = useUpgradeModal()
  const { user } = useUser()
  const { openAuthModal } = useAuthModal()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) closeUpgradeModal()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, loading, closeUpgradeModal])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) { setError(''); setLoading(false) }
  }, [isOpen])

  if (!isOpen) return null

  async function handleCTA() {
    if (!user) {
      closeUpgradeModal()
      openAuthModal()
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Erro ao iniciar checkout. Tente novamente.')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Erro de rede. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => !loading && closeUpgradeModal()}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{
          maxWidth: '440px',
          background: '#0d0d18',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle top glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(47,141,106,0.6), transparent)' }}
        />

        {/* Close */}
        {!loading && (
          <button
            onClick={closeUpgradeModal}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.3)' }}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="px-7 pb-6 pt-7">
          {/* Badge */}
          <span
            className="font-mono-dm inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium uppercase"
            style={{
              letterSpacing: '1px',
              background: 'rgba(47, 141, 106, 0.15)',
              color: '#2f8d6a',
              border: '1px solid rgba(47, 141, 106, 0.3)',
            }}
          >
            <Zap className="h-3 w-3 fill-current" />
            Auto-Apply
          </span>

          {/* Title */}
          <h2
            className="mt-5 font-bold leading-tight text-white"
            style={{ fontSize: '24px', letterSpacing: '-0.5px', lineHeight: '1.3' }}
          >
            Pare de perder tempo preenchendo formulários.{' '}
            <span style={{ color: '#2f8d6a' }}>Deixa a gente fazer.</span>
          </h2>

          {/* Price */}
          <p className="mt-3 text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <span className="font-semibold text-white">R$14,90/semana</span>
            {' · '}Cancele quando quiser
          </p>

          {/* Bullets */}
          <div className="mt-6 flex flex-col gap-3">
            {BULLETS.map((b) => (
              <div key={b} className="flex items-start gap-3">
                <CheckCircle
                  className="mt-0.5 h-[18px] w-[18px] flex-shrink-0"
                  style={{ color: '#2f8d6a' }}
                />
                <span className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {b}
                </span>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="mt-4 text-center text-sm" style={{ color: '#f87171' }}>{error}</p>
          )}

          {/* CTA — conic-gradient spinning border */}
          <div className="relative mt-8 overflow-hidden rounded-xl p-[2px]">
            {/* Spinning gradient layer */}
            <div
              className="animate-rotate-gradient absolute"
              style={{
                top: '-100%',
                left: '-100%',
                right: '-100%',
                bottom: '-100%',
                background:
                  'conic-gradient(from 0deg, transparent 0%, #2f8d6a 25%, #10b981 40%, transparent 55%)',
              }}
            />
            {/* Inner button */}
            <button
              onClick={handleCTA}
              disabled={loading}
              className="relative flex w-full items-center justify-center gap-2 rounded-[10px] py-4 text-center text-[15px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: '#0d1a14', letterSpacing: '-0.2px' }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Abrindo checkout…
                </>
              ) : (
                user ? 'Ativar Auto-Apply — R$14,90/semana' : 'Criar conta para assinar'
              )}
            </button>
          </div>

          {/* Dismiss */}
          {!loading && (
            <div className="mt-4 text-center">
              <button
                onClick={closeUpgradeModal}
                className="text-[13px] transition-colors hover:text-white/50"
                style={{ color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Agora não
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
