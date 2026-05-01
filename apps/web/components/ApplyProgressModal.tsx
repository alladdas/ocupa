'use client'

import { useEffect, useRef, useState } from 'react'
import { X, CheckCircle, AlertCircle, FileDown, ExternalLink } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import type { Job } from '@/lib/mock-data'

const ATS_URL = process.env.NEXT_PUBLIC_ATS_BEATER_URL ?? 'https://ocupa-production.up.railway.app'

type Stage = 'auth' | 'creating' | 'generating' | 'pdf' | 'ready' | 'error'

const STAGE_LABELS: Record<Stage, string> = {
  auth:       'Autenticando...',
  creating:   'Analisando vaga...',
  generating: 'Adaptando currículo com IA...',
  pdf:        'Gerando PDF...',
  ready:      'Currículo pronto!',
  error:      'Algo deu errado',
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

interface Props {
  job: Job
  atsProfileId: number
  onClose: () => void
}

export default function ApplyProgressModal({ job, atsProfileId, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('auth')
  const [errorMsg, setErrorMsg] = useState('')
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    runApplyFlow()
    return () => {
      cancelledRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runApplyFlow() {
    try {
      // 1. Get ATS JWT
      setStage('auth')
      const supabase = getSupabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.')

      const authRes = await fetch(`${ATS_URL}/auth/supabase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabase_access_token: session.access_token }),
      })
      if (!authRes.ok) throw new Error('Falha na autenticação com o servidor.')
      const { access_token: atsJwt } = await authRes.json()

      if (cancelledRef.current) return

      // 2. Create ATS job
      setStage('creating')
      const jobRes = await fetch(`${ATS_URL}/jobs/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${atsJwt}`,
        },
        body: JSON.stringify({
          profile_id: atsProfileId,
          job_description: {
            company: job.company,
            role: job.title,
            // output_language "portuguese" not yet in ATS enum — using "english"
            output_language: 'english',
            description: stripHtml(job.description ?? '').slice(0, 8000),
          },
        }),
      })
      if (!jobRes.ok) {
        const err = await jobRes.json().catch(() => ({}))
        throw new Error(err?.detail ?? `Erro ao criar vaga (${jobRes.status})`)
      }
      const { job_id: atsJobId } = await jobRes.json()

      if (cancelledRef.current) return

      // 3. Trigger generation
      setStage('generating')
      const genRes = await fetch(`${ATS_URL}/jobs/${atsJobId}/generate-resume`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${atsJwt}` },
      })
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}))
        throw new Error(err?.detail ?? `Erro ao iniciar geração (${genRes.status})`)
      }

      // 4. Poll status (max 120 s)
      for (let i = 0; i < 60; i++) {
        if (cancelledRef.current) return
        await new Promise((r) => setTimeout(r, 2000))

        const statusRes = await fetch(`${ATS_URL}/jobs/${atsJobId}/status`, {
          headers: { Authorization: `Bearer ${atsJwt}` },
        })
        if (!statusRes.ok) continue
        const { status } = await statusRes.json()

        if (status === 'FAILED') throw new Error('A geração do currículo falhou. Tente novamente.')
        if (status === 'GENERATING_PDF') setStage('pdf')
        if (status === 'READY') {
          if (cancelledRef.current) return
          setStage('ready')

          // Fetch PDF as blob (needs auth header)
          const pdfRes = await fetch(`${ATS_URL}/jobs/${atsJobId}/pdf`, {
            headers: { Authorization: `Bearer ${atsJwt}` },
          })
          if (pdfRes.ok) {
            const blob = await pdfRes.blob()
            setPdfBlobUrl(URL.createObjectURL(blob))
          }

          // Open the job URL in a new tab
          window.open(job.applyUrl, '_blank', 'noopener,noreferrer')
          return
        }
      }
      throw new Error('Tempo esgotado. O servidor demorou mais que o esperado.')
    } catch (err) {
      if (cancelledRef.current) return
      setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido')
      setStage('error')
    }
  }

  function handleDownload() {
    if (!pdfBlobUrl) return
    const a = document.createElement('a')
    a.href = pdfBlobUrl
    a.download = `curriculo-${job.company.replace(/\s+/g, '-').toLowerCase()}.pdf`
    a.click()
  }

  const isLoading = !['ready', 'error'].includes(stage)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl p-8"
        style={{ background: 'var(--d-nav)', border: '1px solid var(--d-border)' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 transition-colors hover:bg-white/10"
          style={{ color: 'var(--d-muted)' }}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          {/* Icon / spinner */}
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'var(--d-surface)' }}>
            {stage === 'ready' ? (
              <CheckCircle className="h-8 w-8" style={{ color: '#2f8d6a' }} />
            ) : stage === 'error' ? (
              <AlertCircle className="h-8 w-8" style={{ color: '#ef4444' }} />
            ) : (
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
                style={{ borderTopColor: '#2f8d6a' }}
              />
            )}
          </div>

          {/* Stage label */}
          <p
            className="font-mono-dm text-[10px] font-medium uppercase tracking-widest"
            style={{ color: stage === 'error' ? '#ef4444' : '#2f8d6a' }}
          >
            {STAGE_LABELS[stage]}
          </p>

          {/* Company + role */}
          <h2
            className="mt-2 text-base font-bold leading-tight"
            style={{ color: 'var(--d-text)', letterSpacing: '-0.3px' }}
          >
            {job.title}
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--d-text-2)' }}>
            {job.company}
          </p>

          {/* Progress dots */}
          {isLoading && (
            <div className="mt-5 flex gap-1.5">
              {(['auth', 'creating', 'generating', 'pdf'] as Stage[]).map((s) => {
                const stages: Stage[] = ['auth', 'creating', 'generating', 'pdf', 'ready']
                const active = stages.indexOf(stage) >= stages.indexOf(s)
                return (
                  <div
                    key={s}
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: active ? 24 : 6,
                      background: active ? '#2f8d6a' : 'var(--d-border)',
                    }}
                  />
                )
              })}
            </div>
          )}

          {/* Error message */}
          {stage === 'error' && errorMsg && (
            <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--d-text-2)' }}>
              {errorMsg}
            </p>
          )}

          {/* Ready actions */}
          {stage === 'ready' && (
            <div className="mt-6 flex w-full flex-col gap-2">
              <button
                onClick={handleDownload}
                disabled={!pdfBlobUrl}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: '#2f8d6a' }}
              >
                <FileDown className="h-4 w-4" />
                Baixar currículo adaptado
              </button>
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors"
                style={{
                  background: 'var(--d-surface)',
                  color: 'var(--d-text)',
                  border: '1px solid var(--d-border)',
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir vaga
              </a>
            </div>
          )}

          {/* Retry / close on error */}
          {stage === 'error' && (
            <div className="mt-6 flex w-full flex-col gap-2">
              <button
                onClick={() => { setStage('auth'); setErrorMsg(''); runApplyFlow() }}
                className="flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: '#1d161d' }}
              >
                Tentar novamente
              </button>
              <button
                onClick={onClose}
                className="h-10 w-full rounded-xl text-sm transition-colors hover:bg-white/5"
                style={{ color: 'var(--d-muted)' }}
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
