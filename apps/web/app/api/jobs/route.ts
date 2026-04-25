export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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
  ciandt: 'ci.com.br',
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
  amazon: 'amazon.com.br',
  dtidigital: 'dtidigital.com.br',
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
  amazon: 'Amazon',
  dtidigital: 'DTI Digital',
  hotmart_br: 'Hotmart',
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
  if (/\bdata\b|dados|analytic|scientist|\bbi\b|machine learning|\bml\b|engenharia de dados/.test(t)) return 'Dados'
  if (/product manager|produto|\bpm\b|\bpo\b|product owner/.test(t)) return 'Produto'
  if (/design|\bux\b|\bui\b|designer|figma|visual|criativo/.test(t)) return 'Design'
  if (/marketing|comunicação|mídia|conteúdo|social media|\bseo\b|copywriter|branding/.test(t)) return 'Marketing'
  if (/growth|\bcrm\b|performance|aquisição|retenção|acquisition/.test(t)) return 'Growth'
  if (/financ|contab|tesour|controladoria|fiscal|finance|\bfp&a\b|analista financeiro/.test(t)) return 'Financeiro'
  if (/oper|logist|supply|estoque|fulfillment|atendente|assistente de loja|expedição|almoxarife|abastecimento/.test(t)) return 'Operações'
  return 'Tecnologia'
}

function inferWorkModel(employmentType: string, location: string): WorkModel {
  const loc = location.toLowerCase()
  const emp = employmentType.toLowerCase()
  if (loc.includes('remot') || emp.includes('remot')) return 'remoto'
  if (loc.includes('híbrid') || loc.includes('hybrid') || emp.includes('híbrid') || emp.includes('hybrid')) return 'híbrido'
  return 'presencial'
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
  if (min && max) return `${fmt(min)} - ${fmt(max)}`
  if (min) return `a partir de ${fmt(min)}`
  return `até ${fmt(max!)}`
}

// ─── Filter keyword maps (title-based inference for Supabase ilike) ──────────

const AREA_PATTERNS: Record<Area, string[]> = {
  'Tecnologia': ['engineer', 'developer', 'software', 'backend', 'frontend', 'fullstack', 'mobile', 'devops', 'segurança', 'sistemas'],
  'Dados':      ['analytic', 'scientist', 'machine learning', 'engenharia de dados', ' dados', ' data '],
  'Produto':    ['product manager', 'product owner', 'product', 'produto'],
  'Design':     ['designer', 'figma', 'design'],
  'Marketing':  ['marketing', 'comunicação', 'mídia', 'social media', 'copywriter', 'branding'],
  'Growth':     ['growth', 'performance', 'aquisição', 'retenção'],
  'Financeiro': ['financeiro', 'contabilidade', 'tesouraria', 'controladoria', 'analista financeiro', 'fp&a'],
  'Operações':  ['logística', 'supply chain', 'estoque', 'atendente', 'expedição', 'almoxarife'],
}

const SENIORITY_PATTERNS: Record<Seniority, string[]> = {
  'Júnior': ['júnior', 'junior', ' jr '],
  'Pleno':  ['pleno'],
  'Sênior': ['sênior', 'senior', ' sr '],
  'Lead':   ['lead', 'staff', 'principal', 'head', 'diretor', 'director', 'manager'],
}

// ─── Route ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const offset      = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))
  const search      = searchParams.get('search')?.trim() ?? ''
  const areas       = searchParams.getAll('area') as Area[]
  const seniorities = searchParams.getAll('seniority') as Seniority[]
  const workModels  = searchParams.getAll('workModel')
  const location    = searchParams.get('location')?.trim() ?? ''

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // eslint-disable-next-line prefer-const
  let query = supabase.from('scraped_jobs').select('*').order('posted_at', { ascending: false })

  if (search) {
    // Search across title and company
    query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%`) as typeof query
  }

  if (workModels.length > 0) {
    query = query.in('employment_type', workModels) as typeof query
  }

  if (location) {
    query = query.ilike('location', `%${location}%`) as typeof query
  }

  if (areas.length > 0) {
    const patterns = areas.flatMap((a) => AREA_PATTERNS[a] ?? [])
    if (patterns.length > 0) {
      const clause = patterns.map((p) => `title.ilike.%${p}%`).join(',')
      query = query.or(clause) as typeof query
    }
  }

  if (seniorities.length > 0) {
    const patterns = seniorities.flatMap((s) => SENIORITY_PATTERNS[s] ?? [])
    if (patterns.length > 0) {
      const clause = patterns.map((p) => `title.ilike.%${p}%`).join(',')
      query = query.or(clause) as typeof query
    }
  }

  const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1)

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
      logoUrl: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null,
      location: row.location ?? '',
      workModel: inferWorkModel(row.employment_type ?? '', row.location ?? ''),
      seniority: inferSeniority(row.title ?? ''),
      area: inferArea(row.title ?? ''),
      salary: formatSalary(row.salary_min ?? null, row.salary_max ?? null),
      detectedAt: new Date(row.posted_at ?? row.created_at),
      isOnLinkedin: false,
      applyUrl: row.url ?? '#',
      description: (row.description as string | null) ?? '',
      tags: [],
    }
  })

  return NextResponse.json(jobs, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
