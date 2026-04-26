'use client'

import { useState, useEffect } from 'react'
import { Search, X, RefreshCw, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { stripAccents } from '@/lib/normalize-city'
import {
  AREAS,
  SENIORITIES,
  WORK_MODELS,
  type Area,
  type Seniority,
  type WorkModel,
} from '@/lib/mock-data'
import type { Filters } from '@/components/JobFilters'

interface CityItem {
  name: string
  count: number
}

interface FilterSidebarProps {
  filters: Filters
  onChange: (f: Filters) => void
}

const INITIAL_SHOW = 8
const SEARCH_THRESHOLD = 15

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
          ? 'border-[var(--d-accent-border)] bg-[var(--d-accent-subtle)] text-[var(--d-accent-text)]'
          : 'border-[var(--d-border)] bg-transparent text-[var(--d-text-2)] hover:bg-[var(--d-surface)]'
      )}
    >
      {children}
    </button>
  )
}

export default function FilterSidebar({ filters, onChange }: FilterSidebarProps) {
  const [cities, setCities] = useState<CityItem[]>([])
  const [loadingCities, setLoadingCities] = useState(true)
  const [showAllCities, setShowAllCities] = useState(false)
  const [citySearch, setCitySearch] = useState('')

  useEffect(() => {
    fetch('/api/locations')
      .then(r => r.json())
      .then(data => {
        setCities(data.cities ?? [])
        setLoadingCities(false)
      })
      .catch(() => setLoadingCities(false))
  }, [])

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

  // City list filtering (only active when expanded)
  const filteredCities = showAllCities && citySearch
    ? cities.filter(c =>
        stripAccents(c.name.toLowerCase()).includes(stripAccents(citySearch.toLowerCase()))
      )
    : cities

  const visibleCities = showAllCities ? filteredCities : cities.slice(0, INITIAL_SHOW)
  const hiddenCount = cities.length - INITIAL_SHOW
  const showSearchInput = showAllCities && cities.length > SEARCH_THRESHOLD

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

          {/* Search input (visible only when expanded and cities > threshold) */}
          {showSearchInput && (
            <div className="relative">
              <Search
                className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2"
                style={{ color: 'var(--d-muted)' }}
              />
              <input
                type="text"
                placeholder="Buscar cidade..."
                value={citySearch}
                onChange={e => setCitySearch(e.target.value)}
                className="w-full rounded border py-1 pl-6 pr-2 text-xs outline-none focus:border-[var(--d-accent)]"
                style={{
                  background: 'var(--d-bg)',
                  borderColor: 'var(--d-border)',
                  color: 'var(--d-text)',
                }}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {loadingCities ? (
              // Skeleton placeholders
              [60, 80, 50, 70].map(w => (
                <div
                  key={w}
                  className="h-6 animate-pulse rounded-md"
                  style={{ width: w, background: 'var(--d-surface)' }}
                />
              ))
            ) : (
              visibleCities.map(city => (
                <Chip
                  key={city.name}
                  active={filters.location === city.name}
                  onClick={() =>
                    onChange({
                      ...filters,
                      location: filters.location === city.name ? '' : city.name,
                    })
                  }
                >
                  {city.name}{' '}
                  <span
                    className="text-[10px]"
                    style={{ color: 'var(--d-muted)' }}
                  >
                    ({city.count})
                  </span>
                </Chip>
              ))
            )}
          </div>

          {/* Expand / collapse */}
          {!loadingCities && !showAllCities && hiddenCount > 0 && (
            <button
              onClick={() => setShowAllCities(true)}
              className="flex items-center gap-1 self-start text-[11px] transition-colors hover:opacity-80"
              style={{ color: 'var(--d-muted)' }}
            >
              <ChevronDown className="h-3 w-3" />
              Ver mais (+{hiddenCount} cidades)
            </button>
          )}
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
