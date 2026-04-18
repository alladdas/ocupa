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

export const COMPANY_COLORS: Record<string, string> = {
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
  'rd station': 'bg-blue-500',
  gympass: 'bg-cyan-600',
  btgpactual: 'bg-blue-700',
  bradesco: 'bg-red-700',
  default: 'bg-zinc-700',
}

export function getCompanyColor(slug: string): string {
  return COMPANY_COLORS[slug] ?? COMPANY_COLORS.default
}

export function getCompanyInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}
