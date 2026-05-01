'use client'

import { useEffect, useRef, useState } from 'react'
import { X, CheckCircle, AlertCircle, FileDown, ExternalLink, Upload } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import type { Job } from '@/lib/mock-data'

const ATS_URL = process.env.NEXT_PUBLIC_ATS_BEATER_URL ?? 'https://ocupa-production.up.railway.app'

type Stage = 'checking' | 'upload' | 'uploading' | 'preparing' | 'extracting' | 'creating' | 'generating' | 'pdf' | 'ready' | 'error'

const STAGE_LABELS: Record<Stage, string> = {
  checking:   'Verificando currículo...',
  upload:     'Envie seu currículo',
  uploading:  'Enviando currículo...',
  preparing:  'Preparando perfil...',
  extracting: 'Extraindo dados do currículo...',
  creating:   'Analisando vaga...',
  generating: 'Adaptando currículo com IA...',
  pdf:        'Gerando PDF...',
  ready:      'Currículo pronto!',
  error:      'Algo deu errado',
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractErrorMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    if (typeof e.message === 'string') return e.message
    if (typeof e.error_description === 'string') return e.error_description
    if (typeof e.msg === 'string') return e.msg
    return JSON.stringify(e)
  }
  return String(err) || 'Erro desconhecido'
}

interface Props {
  job: Job
  userId: string
  onClose: () => void
}

export default function ApplyProgressModal({ job, userId, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('checking')
  const [errorMsg, setErrorMsg] = useState('')
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const cancelledRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    cancelledRef.current = false
    checkAndRun()
    return () => { cancelledRef.current = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkAndRun() {
    try {
      setStage('checking')
      const supabase = getSupabaseBrowser()

      console.log('[ApplyModal] checking resumes for user', userId)
      const { data: resume, error: resumeErr } = await supabase
        .from('resumes')
        .select('file_url, file_name')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .single()

      if (resumeErr && resumeErr.code !== 'PGRST116') {
        console.error('[ApplyModal] resumes query failed:', resumeErr)
      }
      console.log('[ApplyModal] primary resume:', resume ?? 'none')

      if (cancelledRef.current) return

      if (!resume) {
        setStage('upload')
        return
      }

      await runAtsFlow(resume.file_url as string, resume.file_name as string)
    } catch (err) {
      if (cancelledRef.current) return
      console.error('[ApplyModal] checkAndRun error:', err)
      setErrorMsg(extractErrorMsg(err))
      setStage('error')
    }
  }

  async function handleFileUpload(file: File) {
    try {
      setStage('uploading')
      const supabase = getSupabaseBrowser()
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
      const path = `${userId}/${Date.now()}-${safeName}`

      console.log('[ApplyModal] uploading CV to Storage:', path)
      const { error } = await supabase.storage.from('resumes').upload(path, file, { upsert: false })
      if (error) {
        console.error('[ApplyModal] Storage upload failed:', error)
        throw new Error(`Falha ao enviar arquivo: ${error.message}`)
      }

      if (cancelledRef.current) return

      await supabase.from('resumes').update({ is_primary: false }).eq('user_id', userId).eq('is_primary', true)
      await supabase.from('resumes').insert({ user_id: userId, file_url: path, file_name: file.name, is_primary: true })

      await runAtsFlow(path, file.name)
    } catch (err) {
      if (cancelledRef.current) return
      console.error('[ApplyModal] handleFileUpload error:', err)
      setErrorMsg(extractErrorMsg(err))
      setStage('error')
    }
  }

  async function runAtsFlow(storagePath: string, fileName: string) {
    try {
      const supabase = getSupabaseBrowser()

      // 1. Get ATS JWT
      setStage('preparing')
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.access_token) throw new Error('Sessão expirada. Faça login novamente.')

      console.log('[ApplyModal] POST /auth/supabase')
      const authRes = await fetch(`${ATS_URL}/auth/supabase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabase_access_token: sessionData.session.access_token }),
      })
      if (!authRes.ok) {
        const body = await authRes.text().catch(() => '(no body)')
        console.error('[ApplyModal] /auth/supabase failed:', authRes.status, body)
        throw new Error(`Falha na autenticação com o servidor (${authRes.status}): ${body}`)
      }
      const { access_token: atsJwt } = await authRes.json() as { access_token: string }
      console.log('[ApplyModal] ATS JWT obtained')

      if (cancelledRef.current) return

      // 2. Ensure ATS profile exists; create if first time
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('ats_profile_id')
        .eq('id', userId)
        .single()

      let atsProfileId = (profileRow as { ats_profile_id: number | null } | null)?.ats_profile_id ?? null
      console.log('[ApplyModal] ats_profile_id from DB:', atsProfileId)

      if (!atsProfileId) {
        console.log('[ApplyModal] downloading CV from Storage:', storagePath)
        const { data: cvBlob, error: dlErr } = await supabase.storage.from('resumes').download(storagePath)
        if (dlErr || !cvBlob) {
          console.error('[ApplyModal] Storage download failed:', dlErr)
          throw new Error(`Não foi possível acessar o currículo: ${dlErr?.message ?? 'blob vazio'}`)
        }

        if (cancelledRef.current) return

        console.log('[ApplyModal] POST /profiles/upload, size:', cvBlob.size)
        const formData = new FormData()
        formData.append('file', cvBlob, fileName)
        const uploadRes = await fetch(`${ATS_URL}/profiles/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${atsJwt}` },
          body: formData,
        })
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({})) as { detail?: string }
          console.error('[ApplyModal] /profiles/upload failed:', uploadRes.status, err)
          throw new Error(err?.detail ?? `Erro ao enviar currículo (${uploadRes.status})`)
        }
        const { profile_id } = await uploadRes.json() as { profile_id: number }
        atsProfileId = profile_id
        console.log('[ApplyModal] ATS profile created, profile_id:', atsProfileId)

        await supabase.from('profiles').upsert({ id: userId, ats_profile_id: atsProfileId })

        // Poll profile status until READY (ATS Beater processes PDF asynchronously)
        setStage('extracting')
        console.log('[ApplyModal] polling profile status for profile_id:', atsProfileId)
        for (let i = 0; i < 40; i++) {
          if (cancelledRef.current) return
          await new Promise((r) => setTimeout(r, 3000))
          const profStatusRes = await fetch(`${ATS_URL}/profiles/${atsProfileId}/status`, {
            headers: { Authorization: `Bearer ${atsJwt}` },
          })
          if (!profStatusRes.ok) {
            console.warn('[ApplyModal] profile status poll non-ok:', profStatusRes.status, '(retry', i, ')')
            continue
          }
          const { status: profStatus } = await profStatusRes.json() as { status: string }
          console.log('[ApplyModal] profile status:', profStatus, '(poll', i, ')')
          if (profStatus === 'FAILED') throw new Error('Falha ao processar o currículo. Tente novamente.')
          if (profStatus === 'READY') break
          if (i === 39) throw new Error('Tempo esgotado ao processar o currículo. Tente novamente.')
        }
      }

      if (cancelledRef.current) return

      // 3. Create ATS job
      setStage('creating')
      console.log('[ApplyModal] POST /jobs/ for profile', atsProfileId)
      const jobRes = await fetch(`${ATS_URL}/jobs/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${atsJwt}` },
        body: JSON.stringify({
          profile_id: atsProfileId,
          job_description: {
            company: job.company,
            role: job.title,
            output_language: 'english',
            description: stripHtml(job.description ?? '').slice(0, 8000),
          },
        }),
      })
      if (!jobRes.ok) {
        const err = await jobRes.json().catch(() => ({})) as { detail?: string }
        console.error('[ApplyModal] /jobs/ failed:', jobRes.status, err)
        throw new Error(err?.detail ?? `Erro ao criar vaga (${jobRes.status})`)
      }
      const { job_id: atsJobId } = await jobRes.json() as { job_id: number }
      console.log('[ApplyModal] ATS job created, job_id:', atsJobId)

      if (cancelledRef.current) return

      // 4. Trigger generation
      setStage('generating')
      console.log('[ApplyModal] POST /jobs/', atsJobId, '/generate-resume')
      const genRes = await fetch(`${ATS_URL}/jobs/${atsJobId}/generate-resume`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${atsJwt}` },
      })
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({})) as { detail?: string }
        console.error('[ApplyModal] /generate-resume failed:', genRes.status, err)
        throw new Error(err?.detail ?? `Erro ao iniciar geração (${genRes.status})`)
      }

      // 5. Poll status (max 120 s)
      console.log('[ApplyModal] polling status for job', atsJobId)
      for (let i = 0; i < 60; i++) {
        if (cancelledRef.current) return
        await new Promise((r) => setTimeout(r, 2000))

        const statusRes = await fetch(`${ATS_URL}/jobs/${atsJobId}/status`, {
          headers: { Authorization: `Bearer ${atsJwt}` },
        })
        if (!statusRes.ok) {
          console.warn('[ApplyModal] status poll non-ok:', statusRes.status, '(retry', i, ')')
          continue
        }
        const { status } = await statusRes.json() as { status: string }
        console.log('[ApplyModal] job status:', status, '(poll', i, ')')

        if (status === 'FAILED') {
          console.error('[ApplyModal] job FAILED for atsJobId', atsJobId)
          throw new Error('A geração do currículo falhou. Tente novamente.')
        }
        if (status === 'GENERATING_PDF') setStage('pdf')
        if (status === 'READY') {
          if (cancelledRef.current) return
          setStage('ready')

          const pdfRes = await fetch(`${ATS_URL}/jobs/${atsJobId}/pdf`, {
            headers: { Authorization: `Bearer ${atsJwt}` },
          })
          if (pdfRes.ok) {
            const blob = await pdfRes.blob()
            setPdfBlobUrl(URL.createObjectURL(blob))
            console.log('[ApplyModal] PDF downloaded, size:', blob.size)
          } else {
            console.warn('[ApplyModal] PDF fetch failed:', pdfRes.status)
          }

          window.open(job.applyUrl, '_blank', 'noopener,noreferrer')
          return
        }
      }
      throw new Error('Tempo esgotado. O servidor demorou mais que o esperado.')
    } catch (err) {
      if (cancelledRef.current) return
      console.error('[ApplyModal] runAtsFlow error:', err)
      setErrorMsg(extractErrorMsg(err))
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

  const isLoading = !['upload', 'ready', 'error'].includes(stage)
  const progressStages: Stage[] = ['checking', 'preparing', 'extracting', 'creating', 'generating', 'pdf']

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
            ) : stage === 'upload' ? (
              <Upload className="h-8 w-8" style={{ color: 'var(--d-muted)' }} />
            ) : (
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-transparent"
                style={{ borderTopColor: '#2f8d6a' }}
              />
            )}
          </div>

          <p
            className="font-mono-dm text-[10px] font-medium uppercase tracking-widest"
            style={{ color: stage === 'error' ? '#ef4444' : stage === 'upload' ? 'var(--d-muted)' : '#2f8d6a' }}
          >
            {STAGE_LABELS[stage]}
          </p>

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
              {progressStages.map((s) => {
                const active = progressStages.indexOf(stage) >= progressStages.indexOf(s)
                return (
                  <div
                    key={s}
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: active ? 24 : 6, background: active ? '#2f8d6a' : 'var(--d-border)' }}
                  />
                )
              })}
            </div>
          )}

          {/* Upload UI */}
          {stage === 'upload' && (
            <div className="mt-6 w-full">
              <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--d-text-2)' }}>
                Você ainda não tem um currículo salvo. Envie seu arquivo para continuar.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleFileUpload(file)
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: '#2f8d6a' }}
              >
                <Upload className="h-4 w-4" />
                Selecionar arquivo
              </button>
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
                style={{ background: 'var(--d-surface)', color: 'var(--d-text)', border: '1px solid var(--d-border)' }}
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
                onClick={() => { setStage('checking'); setErrorMsg(''); void checkAndRun() }}
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
