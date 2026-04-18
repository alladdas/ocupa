'use client'

import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AREAS, SENIORITIES, WORK_MODELS, LOCATIONS, type Area, type Seniority, type WorkModel } from '@/lib/mock-data'

export interface Filters {
  search: string
  areas: Area[]
  seniorities: Seniority[]
  workModels: WorkModel[]
  location: string
}

interface JobFiltersProps {
  filters: Filters
  onChange: (filters: Filters) => void
  total: number
  filtered: number
}

function ToggleChip<T extends string>({
  value,
  selected,
  onToggle,
  label,
}: {
  value: T
  selected: boolean
  onToggle: (v: T) => void
  label?: string
}) {
  return (
    <button
      onClick={() => onToggle(value)}
      className={cn(
        'rounded-full border px-3 py-1 text-sm font-medium transition-all',
        selected
          ? 'border-violet-500 bg-violet-600/20 text-violet-300'
          : 'border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
      )}
    >
      {label ?? value}
    </button>
  )
}

export default function JobFilters({ filters, onChange, total, filtered }: JobFiltersProps) {
  const toggle = <T extends string>(key: keyof Filters, value: T) => {
    const current = filters[key] as T[]
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onChange({ ...filters, [key]: next })
  }

  const hasActiveFilters =
    filters.areas.length > 0 ||
    filters.seniorities.length > 0 ||
    filters.workModels.length > 0 ||
    filters.location !== '' ||
    filters.search !== ''

  const clearAll = () =>
    onChange({ search: '', areas: [], seniorities: [], workModels: [], location: '' })

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          placeholder="Buscar por cargo, empresa ou tecnologia..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30"
        />
        {filters.search && (
          <button
            onClick={() => onChange({ ...filters, search: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter chips scroll container */}
      <div className="flex flex-col gap-3">
        {/* Área */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <span className="flex-shrink-0 text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Área
          </span>
          <div className="flex gap-2">
            {AREAS.map((area) => (
              <ToggleChip
                key={area}
                value={area}
                selected={filters.areas.includes(area)}
                onToggle={(v) => toggle('areas', v)}
              />
            ))}
          </div>
        </div>

        {/* Senioridade */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <span className="flex-shrink-0 text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Nível
          </span>
          <div className="flex gap-2">
            {SENIORITIES.map((s) => (
              <ToggleChip
                key={s}
                value={s}
                selected={filters.seniorities.includes(s)}
                onToggle={(v) => toggle('seniorities', v)}
              />
            ))}
          </div>
        </div>

        {/* Modelo de trabalho */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <span className="flex-shrink-0 text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Modelo
          </span>
          <div className="flex gap-2">
            {WORK_MODELS.map((m) => (
              <ToggleChip
                key={m}
                value={m}
                selected={filters.workModels.includes(m)}
                onToggle={(v) => toggle('workModels', v)}
                label={m.charAt(0).toUpperCase() + m.slice(1)}
              />
            ))}
          </div>
        </div>

        {/* Localização */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <span className="flex-shrink-0 text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Local
          </span>
          <div className="flex gap-2">
            {LOCATIONS.map((loc) => (
              <ToggleChip
                key={loc}
                value={loc}
                selected={filters.location === loc}
                onToggle={(v) =>
                  onChange({ ...filters, location: filters.location === v ? '' : v })
                }
              />
            ))}
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          <span className="font-semibold text-white">{filtered}</span>
          {filtered !== total && (
            <span className="text-zinc-600"> de {total}</span>
          )}{' '}
          vagas encontradas
        </p>
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <X className="h-3.5 w-3.5" />
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  )
}
