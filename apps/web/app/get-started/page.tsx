'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, ArrowLeft, Upload, CheckCircle, Link2, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Answers {
  cvFile: File | null
  cvReady: boolean
  firstName: string
  lastName: string
  phone: string
  city: string
  linkedin: string
  gender: string
  race: string
  disability: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7

const ACCEPTED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
])

const BR_CITIES = [
  'São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Brasília', 'Salvador',
  'Fortaleza', 'Curitiba', 'Manaus', 'Recife', 'Porto Alegre',
  'Belém', 'Goiânia', 'Guarulhos', 'Campinas', 'São Luís',
  'São Gonçalo', 'Maceió', 'Natal', 'Teresina', 'Campo Grande',
  'Florianópolis', 'Vitória', 'Joinville',
]

const GENDER_OPTS = ['Masculino', 'Feminino', 'Não-binário', 'Prefiro não informar']
const RACE_OPTS = ['Branco(a)', 'Preto(a)', 'Pardo(a)', 'Amarelo(a)', 'Indígena', 'Prefiro não informar']
const DISABILITY_OPTS = ['Nenhuma', 'Visual', 'Auditiva', 'Física', 'Intelectual', 'Prefiro não informar']

// ─── Shared styles ────────────────────────────────────────────────────────────

const lbl = 'font-mono-dm block mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[#a89ea8]'
const inp =
  'h-12 w-full rounded-lg border border-[#e8ebe9] bg-transparent px-4 text-sm text-[#1d161d] outline-none transition-colors focus:border-[#2f8d6a] placeholder:text-[#c4bcc4]'

function Btn({
  children, onClick, disabled, type = 'button',
}: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      className="font-mono-dm flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      style={{ background: '#1d161d', letterSpacing: '0.5px' }}
    >
      {children}
    </button>
  )
}

function SkipBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className="font-mono-dm h-10 w-full rounded-xl text-[11px] font-medium uppercase tracking-wider transition-colors hover:bg-black/5"
      style={{ color: '#a89ea8', background: 'none', border: 'none', cursor: 'pointer' }}
    >
      Pular por agora
    </button>
  )
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className="font-mono-dm rounded-full border px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-all"
      style={{
        background: selected ? '#2f8d6a' : 'transparent',
        color: selected ? 'white' : '#6b636b',
        borderColor: selected ? '#2f8d6a' : '#e8ebe9',
      }}
    >
      {label}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GetStartedPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [cvLoading, setCvLoading] = useState(false)
  const [cvError, setCvError] = useState('')
  const [cityQ, setCityQ] = useState('')
  const [cityOpen, setCityOpen] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const markedCompleteRef = useRef(false)

  const [answers, setAnswers] = useState<Answers>({
    cvFile: null, cvReady: false, firstName: '', lastName: '',
    phone: '', city: '', linkedin: '',
    gender: '', race: '', disability: '',
  })

  function patch(partial: Partial<Answers>) {
    setAnswers((prev) => ({ ...prev, ...partial }))
  }

  const next = useCallback(() => setStep((s) => s + 1), [])
  const back = useCallback(() => setStep((s) => Math.max(1, s - 1)), [])

  // Mark onboarding complete when user reaches the done screen
  useEffect(() => {
    if (step > TOTAL_STEPS && !markedCompleteRef.current) {
      markedCompleteRef.current = true
      void (async () => {
        const { data } = await getSupabaseBrowser().auth.getSession()
        const userId = data?.session?.user?.id
        if (!userId) return

        const { error } = await getSupabaseBrowser()
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', userId)

        if (error) {
          console.error('[onboarding] failed to mark complete:', error.message, error.code)
        } else {
          console.log('[onboarding] marked onboarding_completed=true for', userId)
        }
      })()
    }
  }, [step])

  function formatPhone(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }

  async function handleCvDrop(file: File) {
    if (!file) return
    if (!ACCEPTED_MIME.has(file.type)) {
      setCvError('Tipo de arquivo não suportado. Use PDF, DOC, DOCX ou TXT.')
      return
    }
    patch({ cvFile: file })
    setCvLoading(true)
    setCvError('')

    try {
      const supabase = getSupabaseBrowser()
      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session?.user?.id) {
        // Not authenticated — keep locally, mark ready
        patch({ cvReady: true })
        return
      }

      const userId = sessionData.session.user.id
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${userId}/${Date.now()}-${safeName}`

      const { error: uploadErr } = await supabase.storage
        .from('resumes')
        .upload(filePath, file, { upsert: true, contentType: file.type || 'application/octet-stream' })

      if (uploadErr) throw uploadErr

      // Unmark previous primary
      await supabase
        .from('resumes')
        .update({ is_primary: false })
        .eq('user_id', userId)
        .eq('is_primary', true)

      // Insert new primary
      const { error: insertErr } = await supabase.from('resumes').insert({
        user_id: userId,
        file_url: filePath,
        file_name: file.name,
        is_primary: true,
      })

      if (insertErr) throw insertErr

      patch({ cvReady: true })
    } catch (err) {
      console.error('[CV upload]', err)
      const detail = err instanceof Error ? err.message : String(err)
      setCvError(`Não foi possível salvar o currículo: ${detail}`)
    } finally {
      setCvLoading(false)
    }
  }

  async function handleCheckout() {
    setCheckoutLoading(true)
    setCheckoutError('')
    try {
      const { data: sessionData } = await getSupabaseBrowser().auth.getSession()
      const supaUser = sessionData.session?.user
      if (!supaUser) { router.push('/'); return }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: supaUser.id, email: supaUser.email }),
      })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) {
        setCheckoutError(json.error ?? 'Erro ao iniciar checkout. Tente novamente.')
        setCheckoutLoading(false)
        return
      }
      window.location.href = json.url
    } catch {
      setCheckoutError('Erro de rede. Tente novamente.')
      setCheckoutLoading(false)
    }
  }

  const filteredCities = BR_CITIES.filter((c) =>
    c.toLowerCase().includes(cityQ.toLowerCase())
  )

  // ─── Done screen ────────────────────────────────────────────────────────────

  if (step > TOTAL_STEPS) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ background: 'var(--d-bg)' }}>
        <div className="w-full max-w-[480px] rounded-2xl border p-10 text-center" style={{ background: 'white', borderColor: '#e8ebe9' }}>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'rgba(47,141,106,0.1)' }}>
            <CheckCircle className="h-8 w-8" style={{ color: '#2f8d6a' }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1d161d', letterSpacing: '-0.5px' }}>Tudo pronto!</h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: '#a89ea8' }}>
            Seu perfil está completo. Ative o Auto-Apply e comece a receber candidaturas automáticas.
          </p>
          {checkoutError && (
            <p className="mt-4 text-sm" style={{ color: '#ef4444' }}>{checkoutError}</p>
          )}
          <div className="relative mt-8 overflow-hidden rounded-xl p-[2px]">
            <div
              className="animate-rotate-gradient absolute"
              style={{ top: '-100%', left: '-100%', right: '-100%', bottom: '-100%', background: 'conic-gradient(from 0deg, transparent 0%, #2f8d6a 25%, #10b981 40%, transparent 55%)' }}
            />
            <button
              onClick={() => void handleCheckout()}
              disabled={checkoutLoading}
              className="font-mono-dm relative flex w-full items-center justify-center gap-2 rounded-[10px] py-4 text-center text-[13px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: '#0d1a14', letterSpacing: '1px' }}
            >
              {checkoutLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Abrindo checkout…</>
              ) : (
                'Assinar — R$14,90/semana'
              )}
            </button>
          </div>
          <button onClick={() => router.push('/')} className="mt-4 text-[13px] transition-colors hover:text-[#1d161d]/50" style={{ color: '#c4bcc4', background: 'none', border: 'none', cursor: 'pointer' }}>
            Voltar ao início
          </button>
        </div>
      </div>
    )
  }

  // ─── Step content ─────────────────────────────────────────────────────────

  function stepContent() {
    switch (step) {
      // ── Step 1: Upload CV ────────────────────────────────────────────────
      case 1:
        return (
          <>
            <StepHeader badge="Passo 1 de 7" title="Envie seu currículo" sub="Salvamos seu arquivo para adaptar automaticamente a cada vaga que você aplicar." />
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void handleCvDrop(f) }}
              onClick={() => !cvLoading && !answers.cvReady && fileInputRef.current?.click()}
              className="mt-6 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-colors"
              style={{
                borderColor: answers.cvReady ? '#2f8d6a' : cvLoading ? '#2f8d6a' : '#e8ebe9',
                background: answers.cvReady ? 'rgba(47,141,106,0.04)' : 'transparent',
                cursor: cvLoading || answers.cvReady ? 'default' : 'pointer',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleCvDrop(f) }}
              />
              {cvLoading ? (
                <>
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: '#2f8d6a' }} />
                  <p className="font-mono-dm text-xs uppercase tracking-wider" style={{ color: '#2f8d6a' }}>Salvando…</p>
                </>
              ) : answers.cvReady ? (
                <>
                  <CheckCircle className="h-8 w-8" style={{ color: '#2f8d6a' }} />
                  <p className="font-mono-dm text-xs uppercase tracking-wider" style={{ color: '#2f8d6a' }}>
                    {answers.cvFile?.name ?? 'Currículo salvo ✓'}
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8" style={{ color: '#c4bcc4' }} />
                  <p className="text-sm font-medium" style={{ color: '#6b636b' }}>Arraste seu currículo aqui ou clique para escolher</p>
                  <p className="font-mono-dm text-[11px] uppercase" style={{ color: '#c4bcc4' }}>PDF, DOC, DOCX ou TXT · Máx 10 MB</p>
                </>
              )}
            </div>
            {cvError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-orange-500" />
                <p className="text-[12px] leading-relaxed text-orange-700">{cvError}</p>
              </div>
            )}
            <div className="mt-6 flex flex-col gap-2">
              <Btn onClick={next} disabled={!answers.cvReady}>Continuar</Btn>
              <SkipBtn onClick={next} />
            </div>
          </>
        )

      // ── Step 2: Intro checklist ──────────────────────────────────────────
      case 2:
        return (
          <>
            <StepHeader badge="Passo 2 de 7" title="Vamos completar seu perfil" sub="Precisamos de alguns dados para personalizar suas candidaturas." />
            <div className="mt-6 rounded-xl border p-5" style={{ borderColor: '#e8ebe9' }}>
              <div className="flex flex-col gap-3">
                {[
                  { n: '3–4', label: 'Nome e telefone' },
                  { n: '5',   label: 'Sua cidade' },
                  { n: '6',   label: 'LinkedIn (opcional)' },
                  { n: '7',   label: 'Diversidade & Inclusão' },
                ].map((item) => (
                  <div key={item.n} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: 'rgba(47,141,106,0.1)', color: '#2f8d6a' }}>
                      {item.n}
                    </div>
                    <span className="text-sm" style={{ color: '#1d161d' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <Btn onClick={next}>Começar</Btn>
            </div>
          </>
        )

      // ── Step 3: Name ─────────────────────────────────────────────────────
      case 3:
        return (
          <>
            <StepHeader badge="Passo 3 de 7" title="Seu nome completo" sub="Como você quer aparecer nas candidaturas." />
            <div className="mt-6 flex flex-col gap-4">
              <div>
                <label className={lbl}>Primeiro nome</label>
                <input className={inp} placeholder="João" value={answers.firstName} onChange={(e) => patch({ firstName: e.target.value })} autoFocus />
              </div>
              <div>
                <label className={lbl}>Sobrenome</label>
                <input className={inp} placeholder="Lins" value={answers.lastName} onChange={(e) => patch({ lastName: e.target.value })} />
              </div>
            </div>
            <div className="mt-6">
              <Btn onClick={next} disabled={!answers.firstName.trim() || !answers.lastName.trim()}>Continuar</Btn>
            </div>
          </>
        )

      // ── Step 4: Phone ─────────────────────────────────────────────────────
      case 4:
        return (
          <>
            <StepHeader badge="Passo 4 de 7" title="Seu telefone" sub="Para que recrutadores entrem em contato." />
            <div className="mt-6">
              <label className={lbl}>Telefone</label>
              <input className={inp} placeholder="(11) 99999-9999" value={answers.phone} onChange={(e) => patch({ phone: formatPhone(e.target.value) })} inputMode="numeric" autoFocus />
            </div>
            <div className="mt-6">
              <Btn onClick={next} disabled={answers.phone.replace(/\D/g, '').length < 10}>Continuar</Btn>
            </div>
          </>
        )

      // ── Step 5: City ─────────────────────────────────────────────────────
      case 5:
        return (
          <>
            <StepHeader badge="Passo 5 de 7" title="Sua cidade" sub="Usamos isso para filtrar vagas presenciais." />
            <div className="relative mt-6">
              <label className={lbl}>Cidade</label>
              <input
                className={inp}
                placeholder="Digite sua cidade…"
                value={answers.city || cityQ}
                onChange={(e) => { patch({ city: '' }); setCityQ(e.target.value); setCityOpen(true) }}
                onFocus={() => setCityOpen(true)}
                autoFocus
              />
              {cityOpen && cityQ.length > 0 && filteredCities.length > 0 && !answers.city && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border shadow-lg" style={{ background: 'white', borderColor: '#e8ebe9' }}>
                  {filteredCities.slice(0, 6).map((c) => (
                    <button key={c} type="button" className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[#f6f8f7]" style={{ color: '#1d161d' }}
                      onClick={() => { patch({ city: c }); setCityQ(c); setCityOpen(false) }}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-6">
              <Btn onClick={next} disabled={!answers.city}>Continuar</Btn>
            </div>
          </>
        )

      // ── Step 6: LinkedIn ─────────────────────────────────────────────────
      case 6:
        return (
          <>
            <StepHeader badge="Passo 6 de 7" title="Seu LinkedIn" sub="Usamos para complementar seu perfil e aplicar em vagas que exigem." />
            <div className="mt-6">
              <label className={lbl}>URL do LinkedIn</label>
              <div className="relative">
                <Link2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#c4bcc4' }} />
                <input className={`${inp} pl-10`} placeholder="linkedin.com/in/seunome" value={answers.linkedin} onChange={(e) => patch({ linkedin: e.target.value })} autoFocus />
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <Btn onClick={next} disabled={!answers.linkedin.trim()}>Continuar</Btn>
              <SkipBtn onClick={next} />
            </div>
          </>
        )

      // ── Step 7: D&I ──────────────────────────────────────────────────────
      case 7:
        return (
          <>
            <StepHeader badge="Passo 7 de 7" title="Diversidade & Inclusão" sub="Opcional. Usado apenas para vagas com cotas. Nunca compartilhado sem permissão." />
            <div className="mt-6 flex flex-col gap-5">
              <ChipGroup label="Gênero" options={GENDER_OPTS} selected={answers.gender} onSelect={(v) => patch({ gender: v })} />
              <ChipGroup label="Raça / Cor" options={RACE_OPTS} selected={answers.race} onSelect={(v) => patch({ race: v })} />
              <ChipGroup label="Deficiência (PCD)" options={DISABILITY_OPTS} selected={answers.disability} onSelect={(v) => patch({ disability: v })} />
            </div>
            <div className="mt-6">
              <Btn onClick={next} disabled={!answers.gender || !answers.race || !answers.disability}>Concluir</Btn>
            </div>
          </>
        )

      default:
        return null
    }
  }

  // ─── Layout ────────────────────────────────────────────────────────────────

  const progress = ((step - 1) / TOTAL_STEPS) * 100

  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--d-bg)' }}>
      <div className="h-1 w-full" style={{ background: '#e8ebe9' }}>
        <div className="h-full transition-all duration-500" style={{ width: `${progress}%`, background: '#2f8d6a' }} />
      </div>
      <header className="flex h-13 flex-shrink-0 items-center justify-between border-b px-6" style={{ background: 'var(--d-nav)', borderColor: 'var(--d-border)' }}>
        <Link href="/" className="flex items-center gap-1.5">
          <Zap className="h-4 w-4" style={{ color: 'var(--d-accent)', fill: 'var(--d-accent)' }} />
          <span className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--d-text)' }}>ocupa.</span>
        </Link>
        <span className="font-mono-dm text-[11px] uppercase tracking-wider" style={{ color: 'var(--d-muted)' }}>{step} / {TOTAL_STEPS}</span>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-[480px] rounded-2xl border p-8" style={{ background: 'white', borderColor: '#e8ebe9' }}>
          {stepContent()}
        </div>
        {step > 1 && (
          <button onClick={back} className="mt-5 flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70" style={{ color: 'var(--d-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StepHeader({ badge, title, sub }: { badge: string; title: string; sub: string }) {
  return (
    <div>
      <span className="font-mono-dm mb-3 inline-block text-[10px] font-medium uppercase tracking-widest" style={{ color: '#2f8d6a' }}>{badge}</span>
      <h1 className="text-xl font-bold" style={{ color: '#1d161d', letterSpacing: '-0.3px' }}>{title}</h1>
      <p className="mt-1 text-sm leading-relaxed" style={{ color: '#a89ea8' }}>{sub}</p>
    </div>
  )
}

function ChipGroup({ label, options, selected, onSelect }: { label: string; options: string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <div>
      <p className={lbl}>{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => (
          <Chip key={opt} label={opt} selected={selected === opt} onClick={() => onSelect(opt)} />
        ))}
      </div>
    </div>
  )
}
