import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'agora mesmo'
  if (diffMin < 60) return `${diffMin} min atrás`
  if (diffHours < 24) return `${diffHours}h atrás`
  return `${diffDays}d atrás`
}

export function formatSalary(salary: string | null): string {
  return salary ?? 'A combinar'
}

const BRAND_COLORS: Record<string, string> = {
  nubank: 'bg-purple-600',
  ifood: 'bg-red-600',
  stone: 'bg-green-600',
  xpinc: 'bg-yellow-600',
  c6bank: 'bg-yellow-500',
  picpay: 'bg-green-500',
  inter: 'bg-orange-500',
  creditas: 'bg-blue-600',
  quintoandar: 'bg-teal-600',
  vtex: 'bg-pink-600',
  hotmart: 'bg-red-500',
  loft: 'bg-indigo-600',
  gympass: 'bg-cyan-600',
  btgpactual: 'bg-blue-700',
  bradesco: 'bg-red-700',
  neon: 'bg-lime-500',
  ambev: 'bg-amber-600',
  cloudwalk: 'bg-indigo-500',
  dock: 'bg-sky-600',
  alice: 'bg-rose-500',
  flash: 'bg-orange-600',
}

const HASH_PALETTE = [
  'bg-red-600', 'bg-orange-600', 'bg-amber-600', 'bg-yellow-600',
  'bg-lime-600', 'bg-green-600', 'bg-emerald-600', 'bg-teal-600',
  'bg-cyan-600', 'bg-sky-600', 'bg-blue-600', 'bg-indigo-600',
  'bg-violet-600', 'bg-purple-600', 'bg-fuchsia-600', 'bg-pink-600',
]

function hashSlug(slug: string): string {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (Math.imul(31, h) + slug.charCodeAt(i)) | 0
  return HASH_PALETTE[Math.abs(h) % HASH_PALETTE.length]
}

export function getCompanyColor(slug: string): string {
  return BRAND_COLORS[slug] ?? hashSlug(slug)
}

export function getCompanyInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}
