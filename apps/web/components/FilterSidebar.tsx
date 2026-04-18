'use client'

import { Search, X, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AREAS,
  SENIORITIES,
  WORK_MODELS,
  LOCATIONS,
  type Area,
  type Seniority,
  type WorkModel,
} from '@/lib/mock-data'
import type { Filters } from '@/components/JobFilters'

interface FilterSidebarProps {
  filters: Filters
  onChange: (f: Filters) => void
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-md border px-2.5 py-1 text-xs font-medium transition-all',
        active
          ? // Active: accent colors from CSS vars
            'border-[var(--d-accent-border)] bg-[var(--d-accent-subtle)] text-[var(--d-accent-text)]'
          : // Inactive: visible in both light and dark
            'border-[var(--d-border)] bg-transparent text-[var(--d-text-2)] hover:bg-[var(--d-surface)]'
      )}
    >
      {children}
    </button>
  )
}

export default function FilterSidebar({ filters, onChange }: FilterSidebarProps) {
  const toggle = <T extends string>(key: keyof Filters, value: T) => {
    const current = filters[key] as T[]
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onChange({ ...filters, [key]: next })
  }

  const clearAll = () =>
    onChange({ search: '', areas: [], seniorities: [], workModels: [], location: '' })

  const hasFilters =
    filters.areas.length > 0 ||
    filters.seniorities.length > 0 ||
    filters.workModels.length > 0 ||
    filters.location !== '' ||
    filters.search !== ''

  return (
    <aside
      className="flex h-full w-[280px] flex-shrink-0 flex-col border-r"
      style={{ background: 'var(--d-nav)', borderColor: 'var(--d-border)' }}
    >
      {/* Sidebar header */}
      <div
        className="flex h-[52px] flex-shrink-0 items-center justify-between border-b px-4"
        style={{ borderColor: 'var(--d-border)' }}
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--d-muted)' }}
        >
          Preferências / Filtros
        </span>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-[11px] transition-colors hover:opacity-80"
            style={{ color: 'var(--d-muted)' }}
          >
            <X className="h-3 w-3" />
            Limpar
          </button>
        )}
      </div>

      {/* Scrollable filter content */}
      <div className="scrollbar-thin flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: 'var(--d-muted)' }}
          />
          <input
            type="text"
            placeholder="Cargo ou empresa..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full rounded-lg border py-2 pl-8 pr-3 text-xs outline-none transition-colors focus:border-[var(--d-accent)]"
            style={{
              background: 'var(--d-bg)',
              borderColor: 'var(--d-border)',
              color: 'var(--d-text)',
            }}
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--d-muted)' }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Área */}
        <div className="flex flex-col gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--d-muted)' }}
          >
            Área
          </span>
          <div className="flex flex-wrap gap-1.5">
            {AREAS.map((area) => (
              <Chip
                key={area}
                active={filters.areas.includes(area)}
                onClick={() => toggle<Area>('areas', area)}
              >
                {area}
              </Chip>
            ))}
          </div>
        </div>

        {/* Senioridade */}
        <div className="flex flex-col gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--d-muted)' }}
          >
            Senioridade
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SENIORITIES.map((s) => (
              <Chip
                key={s}
                active={filters.seniorities.includes(s)}
                onClick={() => toggle<Seniority>('seniorities', s)}
              >
                {s}
              </Chip>
            ))}
          </div>
        </div>

        {/* Modelo */}
        <div className="flex flex-col gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--d-muted)' }}
          >
            Modelo
          </span>
          <div className="flex flex-wrap gap-1.5">
            {WORK_MODELS.map((m) => (
              <Chip
                key={m}
                active={filters.workModels.includes(m)}
                onClick={() => toggle<WorkModel>('workModels', m)}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </Chip>
            ))}
          </div>
        </div>

        {/* Localização */}
        <div className="flex flex-col gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--d-muted)' }}
          >
            Local
          </span>
          <div className="flex flex-wrap gap-1.5">
            {LOCATIONS.map((loc) => (
              <Chip
                key={loc}
                active={filters.location === loc}
                onClick={() =>
                  onChange({ ...filters, location: filters.location === loc ? '' : loc })
                }
              >
                {loc}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex h-10 flex-shrink-0 items-center justify-center gap-1.5 border-t"
        style={{ borderColor: 'var(--d-border)' }}
      >
        <RefreshCw className="h-3 w-3" style={{ color: 'var(--d-muted)' }} />
        <span
          className="font-mono-dm text-[10px] uppercase tracking-widest"
          style={{ color: 'var(--d-muted)' }}
        >
          Auto-salvo
        </span>
      </div>
    </aside>
  )
}
