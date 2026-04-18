'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowRight, Mail, X, Loader2 } from 'lucide-react'
import { useAuthModal } from '@/components/AuthModalContext'
import { useUser } from '@/components/UserContext'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.658 12.392 17.64 10.08 17.64 9.2z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 170 170" fill="currentColor" aria-hidden="true">
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.2-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.28 2.13-9.54 3.24-12.8 3.35-4.92.21-9.84-1.96-14.75-6.52-3.13-2.73-7.05-7.41-11.76-14.04-5.05-7.08-9.2-15.29-12.46-24.65-3.5-10.11-5.25-19.9-5.25-29.39 0-10.87 2.35-20.24 7.05-28.09 3.69-6.3 8.6-11.27 14.75-14.92 6.15-3.65 12.8-5.51 19.97-5.63 3.91 0 9.05 1.21 15.43 3.59 6.36 2.39 10.45 3.6 12.24 3.6 1.34 0 5.87-1.42 13.56-4.24 7.27-2.62 13.41-3.7 18.44-3.27 13.63 1.1 23.87 6.47 30.68 16.14-12.19 7.39-18.22 17.73-18.1 31 .11 10.33 3.86 18.94 11.23 25.79 3.34 3.17 7.07 5.62 11.22 7.36-.9 2.61-1.85 5.11-2.86 7.51zM119.11 7.24c0 8.1-2.96 15.67-8.86 22.67-7.12 8.32-15.73 13.13-25.07 12.37a25.2 25.2 0 01-.19-3.07c0-7.78 3.39-16.1 9.4-22.9 3-3.44 6.82-6.31 11.45-8.6 4.62-2.26 8.99-3.51 13.1-3.71.12 1.1.17 2.2.17 3.24z" />
    </svg>
  )
}

export default function AuthModal() {
  const { isOpen, closeAuthModal } = useAuthModal()
  const { login } = useUser()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  async function handleLogin(emailToUse: string) {
    if (loading) return
    setLoading(true)
    // Simulate auth round-trip — gives the user a sense that something is happening
    await new Promise((r) => setTimeout(r, 750))
    login(emailToUse)
    closeAuthModal(false)
    setEmail('')
    setLoading(false)
  }

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // Escape closes (no dismiss stamp — user didn't explicitly click "Maybe later")
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) closeAuthModal(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, loading, closeAuthModal])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(3px)' }}
      onClick={() => !loading && closeAuthModal(false)}
    >
      {/* Modal card — always white regardless of app theme */}
      <div
        className="relative w-full overflow-y-auto"
        style={{
          maxWidth: '420px',
          maxHeight: '90vh',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0px 16px 48px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
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
          {/* Label */}
          <p
            className="font-mono-dm mb-4 text-xs font-medium uppercase"
            style={{ letterSpacing: '1px', color: '#2f8d6a' }}
          >
            Começar
          </p>

          {/* Heading */}
          <h1
            className="mb-3 font-normal leading-tight"
            style={{ fontSize: '36px', letterSpacing: '-0.8px', lineHeight: '44px', color: 'rgb(29, 22, 29)' }}
          >
            Configure seus alertas em segundos
          </h1>

          {/* Subtitle */}
          <p
            className="mb-7 text-[15px] leading-6"
            style={{ letterSpacing: '-0.15px', color: 'rgb(87, 78, 87)' }}
          >
            Insira seu email para começar. Vamos sugerir os filtros ideais para o seu perfil
            automaticamente.
          </p>

          <div className="flex flex-col gap-4">
            {/* Email field */}
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
                    if (e.key === 'Enter' && isValidEmail) handleLogin(email)
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

            {/* Continue with email */}
            <button
              disabled={!isValidEmail || loading}
              onClick={() => handleLogin(email)}
              className="font-mono-dm inline-flex h-12 w-full items-center justify-center gap-2 text-sm font-medium uppercase transition-opacity"
              style={{
                letterSpacing: '0.28px',
                background: 'rgb(42, 35, 42)',
                color: 'rgb(250, 249, 250)',
                borderRadius: '4px',
                boxShadow: 'rgba(0, 0, 0, 0.5) 0px 0px 12px 0px inset',
                opacity: isValidEmail && !loading ? 1 : 0.5,
                cursor: isValidEmail && !loading ? 'pointer' : 'not-allowed',
                border: 'none',
              }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Continuar com Email
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
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

            {/* Google */}
            <button
              disabled={loading}
              onClick={() => handleLogin('voce@gmail.com')}
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
              <GoogleIcon />
              Continuar com Google
            </button>

            {/* Apple */}
            <button
              disabled={loading}
              onClick={() => handleLogin('voce@icloud.com')}
              className="flex h-12 w-full items-center justify-center gap-2.5 text-[15px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                letterSpacing: '-0.15px',
                borderRadius: '4px',
                border: '1px solid rgb(29, 22, 29)',
                background: 'rgb(29, 22, 29)',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              <AppleIcon />
              Continuar com Apple
            </button>
          </div>
        </div>

        {/* Maybe later */}
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
