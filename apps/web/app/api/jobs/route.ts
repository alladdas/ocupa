import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
import type { Job, WorkModel, Seniority, Area } from '@/lib/mock-data'

// ─── Company slug → clearbit domain ──────────────────────────────────────────
// Gupy companies confirmed on public portal: ambev, renner, boticario, vivo, dasa
// Greenhouse companies: nubank, wildlifestudios, cloudwalk, neon, caju, flash, alice, dock, unico, ciandt

const DOMAIN_MAP: Record<string, string> = {
  // Gupy (confirmed on public portal)
  ambev: 'ambev.com.br',
  renner: 'lojasrenner.com.br',
  boticario: 'grupoboticario.com.br',
  vivo: 'vivo.com.br',
  dasa: 'dasa.com.br',
  // Greenhouse
  nubank: 'nubank.com.br',
  wildlifestudios: 'wildlifestudios.com',
  cloudwalk: 'cloudwalk.io',
  neon: 'neon.com.br',
  caju: 'caju.com.br',
  flash: 'flashapp.com.br',
  alice: 'alice.com.br',
  dock: 'dock.tech',
  unico: 'unico.io',
  ciandt: 'ciandt.com',
  // Mock data compat
  ifood: 'ifood.com.br',
  mercadolivre: 'mercadolivre.com.br',
  stone: 'stone.com.br',
  xpinc: 'xpi.com.br',
  btgpactual: 'btgpactual.com',
  c6bank: 'c6bank.com.br',
  picpay: 'picpay.com',
  itau: 'itau.com.br',
  bradesco: 'bradesco.com.br',
  inter: 'inter.co',
  creditas: 'creditas.com',
  loft: 'loft.com.br',
  quintoandar: 'quintoandar.com',
  vtex: 'vtex.com',
  hotmart: 'hotmart.com',
  rdstation: 'rdstation.com',
  gympass: 'gympass.com',
  loggi: 'loggi.com',
  '99app': '99app.com',
  kavak: 'kavak.com',
  claro: 'claro.com.br',
  tim: 'tim.com.br',
  natura: 'natura.com.br',
  magazineluiza: 'magazineluiza.com.br',
  rededeaor: 'rededeaor.com.br',
}

// ─── Company slug → display name ─────────────────────────────────────────────

const NAME_MAP: Record<string, string> = {
  ifood: 'iFood',
  mercadolivre: 'Mercado Livre',
  stone: 'Stone',
  xpinc: 'XP Inc',
  btgpactual: 'BTG Pactual',
  c6bank: 'C6 Bank',
  picpay: 'PicPay',
  itau: 'Itaú',
  bradesco: 'Bradesco',
  inter: 'Inter',
  creditas: 'Creditas',
  loft: 'Loft',
  quintoandar: 'QuintoAndar',
  vtex: 'VTEX',
  hotmart: 'Hotmart',
  rdstation: 'RD Station',
  gympass: 'Gympass',
  loggi: 'Loggi',
  '99app': '99',
  kavak: 'Kavak',
  vivo: 'Vivo',
  claro: 'Claro',
  tim: 'TIM',
  natura: 'Natura',
  boticario: 'Grupo Boticário',
  renner: 'Renner',
  magazineluiza: 'Magazine Luiza',
  ambev: 'Ambev',
  dasa: 'DASA',
  rededeaor: 'Rede D\'Or',
  nubank: 'Nubank',
  wildlifestudios: 'Wildlife Studios',
  cloudwalk: 'CloudWalk',
  neon: 'Neon',
  caju: 'Caju',
  flash: 'Flash',
  alice: 'Alice',
  dock: 'Dock',
  unico: 'Unico',
  ciandt: 'CI&T',
}

// ─── Inference helpers ────────────────────────────────────────────────────────

function inferArea(title: string): Area {
  const t = title.toLowerCase()
  if (/data|dados|analytic|scientist|bi\b|machine learning|\bml\b|engenharia de dados/.test(t)) return 'Dados'
  if (/product manager|produto|product owner|\bpm\b/.test(t)) return 'Produto'
  if (/design|ux|ui\b|designer|figma/.test(t)) return 'Design'
  if (/marketing|seo|cro|mídia|ads|email mkt/.test(t)) return 'Marketing'
  if (/growth|acquisition|crm/.test(t)) return 'Growth'
  if (/financ|contab|tesour|controladoria|fiscal/.test(t)) return 'Financeiro'
  if (/oper|logist|supply|estoque|fulfillment/.test(t)) return 'Operações'
  return 'Tecnologia'
}

function inferSeniority(title: string): Seniority {
  const t = title.toLowerCase()
  if (/júnior|junior|\bjr\.?\b/.test(t)) return 'Júnior'
  if (/sênior|senior|\bsr\.?\b/.test(t)) return 'Sênior'
  if (/\blead\b|staff|principal|\bhead\b|diretor|director|manager/.test(t)) return 'Lead'
  return 'Pleno'
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null
  const fmt = (v: number) => `R$ ${(v / 1000).toFixed(0)}k`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `a partir de ${fmt(min)}`
  return `até ${fmt(max!)}`
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data, error } = await supabase
    .from('scraped_jobs')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const jobs: Job[] = (data ?? []).map((row) => {
    const slug = (row.company ?? '').toLowerCase().replace(/\s+/g, '')
    const domain = DOMAIN_MAP[slug]

    return {
      id: String(row.id),
      title: row.title ?? '',
      company: NAME_MAP[slug] ?? row.company ?? slug,
      companySlug: slug,
      logoUrl: domain ? `https://logo.clearbit.com/${domain}` : null,
      location: row.location ?? '',
      workModel: (row.employment_type ?? 'presencial') as WorkModel,
      seniority: inferSeniority(row.title ?? ''),
      area: inferArea(row.title ?? ''),
      salary: formatSalary(row.salary_min ?? null, row.salary_max ?? null),
      detectedAt: new Date(row.posted_at ?? row.created_at),
      isOnLinkedin: false,
      applyUrl: row.url ?? '#',
      description: '',
      tags: [],
    }
  })

  return NextResponse.json(jobs)
}
