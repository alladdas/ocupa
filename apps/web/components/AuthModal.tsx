'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowRight, Mail, X, Loader2, CheckCircle } from 'lucide-react'
import { useAuthModal } from '@/components/AuthModalContext'
import { useUser } from '@/components/UserContext'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.658 12.392 17.64 10.08 17.64 9.2z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  )
}

export default function AuthModal() {
  const { isOpen, closeAuthModal } = useAuthModal()
  const { user } = useUser()
  const [email, setEmail] = useState('')
  const [loadingFor, setLoadingFor] = useState<'google' | 'email' | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const loading = loadingFor !== null
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  // Close when auth succeeds (Google redirect comes back, OTP link clicked)
  useEffect(() => {
    if (user && isOpen) closeAuthModal(false)
  }, [user, isOpen, closeAuthModal])

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setEmail('')
      setEmailSent(false)
      setError('')
      setLoadingFor(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && !emailSent) {
      const t = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [isOpen, emailSent])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) closeAuthModal(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, loading, closeAuthModal])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  async function handleGoogleLogin() {
    if (loading) return
    setLoadingFor('google')
    setError('')
    const { error: err } = await getSupabaseBrowser().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (err) {
      setError(err.message)
      setLoadingFor(null)
    }
    // On success the browser redirects to Google — loading stays visible
  }

  async function handleEmailOtp() {
    if (!isValidEmail || loading) return
    setLoadingFor('email')
    setError('')
    const { error: err } = await getSupabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoadingFor(null)
    if (err) {
      setError(err.message)
    } else {
      setEmailSent(true)
    }
  }

  if (!isOpen) return null

  // ── Email sent confirmation ───────────────────────────────────────────────
  if (emailSent) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
        onClick={() => closeAuthModal(false)}
      >
        <div
          className="relative w-full text-center"
          style={{
            maxWidth: '420px',
            background: 'white',
            borderRadius: '12px',
            padding: '48px 32px',
            boxShadow: '0px 16px 48px rgba(0,0,0,0.15)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => closeAuthModal(false)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/5"
            style={{ color: 'rgb(168, 158, 168)' }}
          >
            <X className="h-4 w-4" />
          </button>
          <CheckCircle className="mx-auto mb-4 h-12 w-12" style={{ color: '#2f8d6a' }} />
          <h2
            className="mb-3 font-semibold"
            style={{ fontSize: '22px', color: 'rgb(29, 22, 29)' }}
          >
            Verifique seu email
          </h2>
          <p style={{ color: 'rgb(87, 78, 87)', fontSize: '15px', lineHeight: '1.6' }}>
            Enviamos um link de acesso para <strong>{email}</strong>.
            <br />Clique no link para entrar.
          </p>
        </div>
      </div>
    )
  }

  // ── Main modal ────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={() => !loading && closeAuthModal(false)}
    >
      <div
        className="relative w-full overflow-y-auto"
        style={{
          maxWidth: '420px',
          maxHeight: '90vh',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0px 16px 48px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!loading && (
          <button
            onClick={() => closeAuthModal(false)}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/5"
            style={{ color: 'rgb(168, 158, 168)' }}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="px-6 pb-6 pt-8">
          <p
            className="font-mono-dm mb-4 text-xs font-medium uppercase"
            style={{ letterSpacing: '1px', color: '#2f8d6a' }}
          >
            Começar
          </p>
          <h1
            className="mb-3 font-normal leading-tight"
            style={{ fontSize: '36px', letterSpacing: '-0.8px', lineHeight: '44px', color: 'rgb(29, 22, 29)' }}
          >
            Configure seus alertas em segundos
          </h1>
          <p
            className="mb-7 text-[15px] leading-6"
            style={{ letterSpacing: '-0.15px', color: 'rgb(87, 78, 87)' }}
          >
            Insira seu email para começar. Vamos sugerir os filtros ideais para o seu perfil
            automaticamente.
          </p>

          <div className="flex flex-col gap-4">
            {/* Google OAuth */}
            <button
              disabled={loading}
              onClick={handleGoogleLogin}
              className="flex h-12 w-full items-center justify-center gap-2.5 text-[15px] font-medium transition-colors hover:bg-black/[0.03] disabled:opacity-50"
              style={{
                letterSpacing: '-0.15px',
                borderRadius: '4px',
                border: '1px solid rgb(209, 214, 211)',
                background: 'white',
                color: 'rgb(29, 22, 29)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loadingFor === 'google' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continuar com Google
            </button>

            {/* OR */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1" style={{ background: 'rgb(209, 214, 211)' }} />
              <span
                className="font-mono-dm text-[13px]"
                style={{ letterSpacing: '0.5px', color: 'rgb(168, 158, 168)' }}
              >
                OU
              </span>
              <div className="h-px flex-1" style={{ background: 'rgb(209, 214, 211)' }} />
            </div>

            {/* Email */}
            <div>
              <label
                className="font-mono-dm mb-2 block text-[11px] font-medium uppercase"
                style={{ letterSpacing: '1px', color: 'rgb(168, 158, 168)' }}
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                  width={18}
                  height={18}
                  style={{ color: 'rgb(168, 158, 168)' }}
                />
                <input
                  ref={inputRef}
                  type="email"
                  placeholder="voce@email.com"
                  value={email}
                  disabled={loading}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isValidEmail) handleEmailOtp()
                  }}
                  style={{
                    width: '100%',
                    height: '48px',
                    paddingLeft: '42px',
                    paddingRight: '16px',
                    fontSize: '16px',
                    fontFamily: 'Inter, sans-serif',
                    letterSpacing: '-0.16px',
                    color: 'rgb(29, 22, 29)',
                    background: loading ? 'rgb(250,250,250)' : 'white',
                    border: '1px solid rgb(209, 214, 211)',
                    borderRadius: '4px',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    opacity: loading ? 0.6 : 1,
                  }}
                  onFocus={(e) => { if (!loading) e.currentTarget.style.borderColor = '#2f8d6a' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgb(209, 214, 211)' }}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>
            )}

            <button
              disabled={!isValidEmail || loading}
              onClick={handleEmailOtp}
              className="font-mono-dm inline-flex h-12 w-full items-center justify-center gap-2 text-sm font-medium uppercase transition-opacity"
              style={{
                letterSpacing: '0.28px',
                background: 'rgb(42, 35, 42)',
                color: 'rgb(250, 249, 250)',
                borderRadius: '4px',
                boxShadow: 'rgba(0,0,0,0.5) 0px 0px 12px 0px inset',
                opacity: isValidEmail && !loading ? 1 : 0.5,
                cursor: isValidEmail && !loading ? 'pointer' : 'not-allowed',
                border: 'none',
              }}
            >
              {loadingFor === 'email' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Continuar com Email
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {!loading && (
          <div className="pb-5 text-center">
            <button
              onClick={() => closeAuthModal(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgb(120, 108, 120)',
                fontSize: '13px',
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              Talvez depois
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
