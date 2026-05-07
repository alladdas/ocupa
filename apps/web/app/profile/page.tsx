'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Upload, AlertCircle, Link2 } from 'lucide-react'
import DashNav from '@/components/DashNav'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import { useUser } from '@/components/UserContext'

// ─── Constants ────────────────────────────────────────────────────────────────

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
  'Maceió', 'Natal', 'Teresina', 'Campo Grande',
  'Florianópolis', 'Vitória', 'Joinville',
]

const SENIORITY_OPTS = ['Estágio', 'Júnior', 'Pleno', 'Sênior', 'Especialista', 'Gerente', 'Diretor']
const JOB_TYPE_OPTS  = ['CLT', 'PJ', 'Freelance', 'Estágio', 'Temporário']
const WORK_MODEL_OPTS = ['Remoto', 'Híbrido', 'Presencial']
const GENDER_OPTS = ['Homem Cis', 'Mulher Cis', 'Homem Trans', 'Mulher Trans', 'Não-binário', 'Prefiro não informar']
const RACE_OPTS = ['Branco', 'Preto', 'Pardo', 'Amarelo', 'Indígena', 'Prefiro não informar']

// ─── Types ────────────────────────────────────────────────────────────────────

interface PersonalData {
  first_name: string
  last_name: string
  phone: string
  city: string
  linkedin_url: string
}

interface JobPrefs {
  job_type: string
  seniority: string
  work_model: string
}

interface DiversityData {
  gender: string
  race: string
}

type ProfileRow = PersonalData & JobPrefs & DiversityData & { [k: string]: unknown }

// ─── Shared styles ────────────────────────────────────────────────────────────

const inp = 'h-11 w-full rounded-lg border border-[#e8ebe9] bg-transparent px-3.5 text-sm text-[#1d161d] outline-none transition-colors focus:border-[#2f8d6a] placeholder:text-[#c4bcc4]'
const lbl = 'block mb-1 text-[11px] font-medium uppercase tracking-wider text-[#a89ea8]'

function SaveBtn({ saving, saved, onClick, disabled }: { saving: boolean; saved: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={saving || disabled}
      className="font-mono-dm flex h-10 items-center gap-2 rounded-xl px-5 text-[11px] font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      style={{ background: saved ? '#2f8d6a' : '#1d161d' }}
    >
      {saving ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: 'white' }} />
      ) : saved ? (
        <><CheckCircle className="h-3.5 w-3.5" />Salvo</>
      ) : (
        'Salvar'
      )}
    </button>
  )
}

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono-dm rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-all"
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-2xl border bg-white p-6" style={{ borderColor: '#e8ebe9' }}>
      <h2 className="mb-5 text-base font-bold" style={{ color: '#1d161d', letterSpacing: '-0.2px' }}>{title}</h2>
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, loading } = useUser()
  const router = useRouter()

  const [personal, setPersonal] = useState<PersonalData>({
    first_name: '', last_name: '', phone: '', city: '', linkedin_url: '',
  })
  const [prefs, setPrefs] = useState<JobPrefs>({ job_type: '', seniority: '', work_model: '' })
  const [diversity, setDiversity] = useState<DiversityData>({ gender: '', race: '' })
  const [resume, setResume] = useState<{ file_name: string } | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  const [savingPersonal, setSavingPersonal] = useState(false)
  const [savedPersonal, setSavedPersonal] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [savedPrefs, setSavedPrefs] = useState(false)
  const [savingDiversity, setSavingDiversity] = useState(false)
  const [savedDiversity, setSavedDiversity] = useState(false)
  const [savePersonalErr, setSavePersonalErr] = useState('')
  const [savePrefsErr, setSavePrefsErr] = useState('')
  const [saveDiversityErr, setSaveDiversityErr] = useState('')

  const [cvLoading, setCvLoading] = useState(false)
  const [cvSaved, setCvSaved] = useState(false)
  const [cvError, setCvError] = useState('')

  const [cityQ, setCityQ] = useState('')
  const [cityOpen, setCityOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) router.replace('/')
  }, [user, loading, router])

  // Load profile + primary resume
  useEffect(() => {
    if (!user) return
    const supabase = getSupabaseBrowser()

    Promise.all([
      supabase
        .from('profiles')
        .select('first_name, last_name, phone, city, linkedin_url, job_type, seniority, work_model, gender, race')
        .eq('id', user.id)
        .single(),
      supabase
        .from('resumes')
        .select('file_name')
        .eq('user_id', user.id)
        .eq('is_primary', true)
        .single(),
    ]).then(([profileRes, resumeRes]) => {
      if (profileRes.data) {
        const d = profileRes.data as ProfileRow
        setPersonal({
          first_name:   d.first_name   ?? '',
          last_name:    d.last_name    ?? '',
          phone:        d.phone        ?? '',
          city:         d.city         ?? '',
          linkedin_url: d.linkedin_url ?? '',
        })
        setCityQ(d.city ?? '')
        setPrefs({
          job_type:   d.job_type   ?? '',
          seniority:  d.seniority  ?? '',
          work_model: d.work_model ?? '',
        })
        setDiversity({
          gender: d.gender ?? '',
          race:   d.race   ?? '',
        })
      }
      if (resumeRes.data) setResume(resumeRes.data as { file_name: string })
      setDataLoading(false)
    })
  }, [user])

  function formatPhone(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }

  async function savePersonal() {
    if (!user) return
    setSavingPersonal(true)
    setSavePersonalErr('')
    const { error } = await getSupabaseBrowser()
      .from('profiles')
      .update(personal)
      .eq('id', user.id)
    setSavingPersonal(false)
    if (error) {
      setSavePersonalErr(error.message)
    } else {
      setSavedPersonal(true)
      setTimeout(() => setSavedPersonal(false), 2500)
    }
  }

  async function savePrefs() {
    if (!user) return
    setSavingPrefs(true)
    setSavePrefsErr('')
    const { error } = await getSupabaseBrowser()
      .from('profiles')
      .update(prefs)
      .eq('id', user.id)
    setSavingPrefs(false)
    if (error) {
      setSavePrefsErr(error.message)
    } else {
      setSavedPrefs(true)
      setTimeout(() => setSavedPrefs(false), 2500)
    }
  }

  async function saveDiversity() {
    if (!user) return
    setSavingDiversity(true)
    setSaveDiversityErr('')
    const { error } = await getSupabaseBrowser()
      .from('profiles')
      .update(diversity)
      .eq('id', user.id)
    setSavingDiversity(false)
    if (error) {
      setSaveDiversityErr(error.message)
    } else {
      setSavedDiversity(true)
      setTimeout(() => setSavedDiversity(false), 2500)
    }
  }

  async function handleCvChange(file: File) {
    if (!user) return
    if (!ACCEPTED_MIME.has(file.type)) {
      setCvError('Tipo não suportado. Use PDF, DOC, DOCX ou TXT.')
      return
    }
    setCvLoading(true)
    setCvError('')
    setCvSaved(false)
    try {
      const supabase = getSupabaseBrowser()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${user.id}/${Date.now()}-${safeName}`

      const { error: upErr } = await supabase.storage
        .from('resumes')
        .upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' })
      if (upErr) throw upErr

      await supabase.from('resumes').update({ is_primary: false }).eq('user_id', user.id).eq('is_primary', true)
      const { error: insErr } = await supabase.from('resumes').insert({
        user_id: user.id, file_url: path, file_name: file.name, is_primary: true,
      })
      if (insErr) throw insErr

      setResume({ file_name: file.name })
      setCvSaved(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message
        : (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message)
        : JSON.stringify(err)
      setCvError(`Falha ao enviar: ${msg}`)
    } finally {
      setCvLoading(false)
    }
  }

  const filteredCities = BR_CITIES.filter((c) =>
    c.toLowerCase().includes(cityQ.toLowerCase())
  )

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--d-bg)' }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: '#2f8d6a' }} />
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="min-h-screen" style={{ background: 'var(--d-bg)' }}>
      <DashNav />

      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold" style={{ color: 'var(--d-text)', letterSpacing: '-0.5px' }}>
          Meu perfil
        </h1>

        {/* ── Currículo ─────────────────────────────────────────────────────── */}
        <SectionCard title="Currículo">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              {resume ? (
                <p className="truncate text-sm font-medium" style={{ color: 'var(--d-text)' }}>
                  {resume.file_name}
                </p>
              ) : (
                <p className="text-sm italic" style={{ color: 'var(--d-muted)' }}>
                  Nenhum currículo enviado ainda
                </p>
              )}
              <p className="font-mono-dm mt-0.5 text-[11px] uppercase" style={{ color: 'var(--d-muted)' }}>
                PDF, DOC, DOCX ou TXT · Máx 10 MB
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleCvChange(f) }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={cvLoading}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{
                background: cvSaved ? 'rgba(47,141,106,0.1)' : 'var(--d-surface)',
                color: cvSaved ? '#2f8d6a' : 'var(--d-text)',
                border: '1px solid var(--d-border)',
              }}
            >
              {cvLoading ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: '#2f8d6a' }} />
              ) : cvSaved ? (
                <><CheckCircle className="h-3.5 w-3.5" />Salvo!</>
              ) : (
                <><Upload className="h-3.5 w-3.5" />{resume ? 'Trocar currículo' : 'Enviar currículo'}</>
              )}
            </button>
          </div>

          {cvError && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-orange-500" />
              <p className="text-[12px] leading-relaxed text-orange-700">{cvError}</p>
            </div>
          )}
        </SectionCard>

        {/* ── Dados pessoais ────────────────────────────────────────────────── */}
        <SectionCard title="Dados pessoais">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Primeiro nome</label>
              <input
                className={inp}
                placeholder="João"
                value={personal.first_name}
                onChange={(e) => setPersonal((p) => ({ ...p, first_name: e.target.value }))}
              />
            </div>
            <div>
              <label className={lbl}>Sobrenome</label>
              <input
                className={inp}
                placeholder="Silva"
                value={personal.last_name}
                onChange={(e) => setPersonal((p) => ({ ...p, last_name: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className={lbl}>Telefone</label>
            <input
              className={inp}
              placeholder="(11) 99999-9999"
              inputMode="numeric"
              value={personal.phone}
              onChange={(e) => setPersonal((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
            />
          </div>

          <div className="relative mt-4">
            <label className={lbl}>Cidade</label>
            <input
              className={inp}
              placeholder="Digite sua cidade…"
              value={personal.city || cityQ}
              onChange={(e) => {
                setPersonal((p) => ({ ...p, city: '' }))
                setCityQ(e.target.value)
                setCityOpen(true)
              }}
              onFocus={() => setCityOpen(true)}
              onBlur={() => setTimeout(() => setCityOpen(false), 150)}
            />
            {cityOpen && cityQ.length > 0 && filteredCities.length > 0 && !personal.city && (
              <div
                className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border shadow-lg"
                style={{ background: 'white', borderColor: '#e8ebe9' }}
              >
                {filteredCities.slice(0, 6).map((c) => (
                  <button
                    key={c} type="button"
                    className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-[#f6f8f7]"
                    style={{ color: '#1d161d' }}
                    onMouseDown={() => {
                      setPersonal((p) => ({ ...p, city: c }))
                      setCityQ(c)
                      setCityOpen(false)
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4">
            <label className={lbl}>LinkedIn</label>
            <div className="relative">
              <Link2 className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#c4bcc4' }} />
              <input
                className={`${inp} pl-10`}
                placeholder="linkedin.com/in/seunome"
                value={personal.linkedin_url}
                onChange={(e) => setPersonal((p) => ({ ...p, linkedin_url: e.target.value }))}
              />
            </div>
          </div>

          {savePersonalErr && (
            <p className="mt-3 text-xs" style={{ color: '#ef4444' }}>{savePersonalErr}</p>
          )}

          <div className="mt-5 flex justify-end">
            <SaveBtn saving={savingPersonal} saved={savedPersonal} onClick={() => void savePersonal()} />
          </div>
        </SectionCard>

        {/* ── Preferências de vaga ──────────────────────────────────────────── */}
        <SectionCard title="Preferências de vaga">
          <div className="flex flex-col gap-5">
            <div>
              <p className={lbl}>Tipo de contrato</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {JOB_TYPE_OPTS.map((opt) => (
                  <Chip
                    key={opt} label={opt}
                    selected={prefs.job_type === opt}
                    onClick={() => setPrefs((p) => ({ ...p, job_type: p.job_type === opt ? '' : opt }))}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className={lbl}>Senioridade</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SENIORITY_OPTS.map((opt) => (
                  <Chip
                    key={opt} label={opt}
                    selected={prefs.seniority === opt}
                    onClick={() => setPrefs((p) => ({ ...p, seniority: p.seniority === opt ? '' : opt }))}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className={lbl}>Modelo de trabalho</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {WORK_MODEL_OPTS.map((opt) => (
                  <Chip
                    key={opt} label={opt}
                    selected={prefs.work_model === opt}
                    onClick={() => setPrefs((p) => ({ ...p, work_model: p.work_model === opt ? '' : opt }))}
                  />
                ))}
              </div>
            </div>
          </div>

          {savePrefsErr && (
            <p className="mt-3 text-xs" style={{ color: '#ef4444' }}>{savePrefsErr}</p>
          )}

          <div className="mt-5 flex justify-end">
            <SaveBtn saving={savingPrefs} saved={savedPrefs} onClick={() => void savePrefs()} />
          </div>
        </SectionCard>

        {/* ── Diversidade e inclusão ────────────────────────────────────────── */}
        <SectionCard title="Diversidade e inclusão">
          <div className="flex flex-col gap-5">
            <div>
              <p className={lbl}>Gênero</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {GENDER_OPTS.map((opt) => (
                  <Chip
                    key={opt} label={opt}
                    selected={diversity.gender === opt}
                    onClick={() => setDiversity((d) => ({ ...d, gender: d.gender === opt ? '' : opt }))}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className={lbl}>Raça/Cor</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {RACE_OPTS.map((opt) => (
                  <Chip
                    key={opt} label={opt}
                    selected={diversity.race === opt}
                    onClick={() => setDiversity((d) => ({ ...d, race: d.race === opt ? '' : opt }))}
                  />
                ))}
              </div>
            </div>
          </div>

          {saveDiversityErr && (
            <p className="mt-3 text-xs" style={{ color: '#ef4444' }}>{saveDiversityErr}</p>
          )}

          <div className="mt-5 flex justify-end">
            <SaveBtn saving={savingDiversity} saved={savedDiversity} onClick={() => void saveDiversity()} />
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
