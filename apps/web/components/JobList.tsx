'use client'

import { useState, useMemo } from 'react'
import { BriefcaseBusiness } from 'lucide-react'
import JobCard from './JobCard'
import JobFilters, { type Filters } from './JobFilters'
import { MOCK_JOBS } from '@/lib/mock-data'

const DEFAULT_FILTERS: Filters = {
  search: '',
  areas: [],
  seniorities: [],
  workModels: [],
  location: '',
}

export default function JobList() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

  const filteredJobs = useMemo(() => {
    return MOCK_JOBS.filter((job) => {
      const q = filters.search.toLowerCase()
      if (
        q &&
        !job.title.toLowerCase().includes(q) &&
        !job.company.toLowerCase().includes(q) &&
        !job.tags.some((t) => t.toLowerCase().includes(q))
      ) {
        return false
      }
      if (filters.areas.length > 0 && !filters.areas.includes(job.area)) return false
      if (filters.seniorities.length > 0 && !filters.seniorities.includes(job.seniority))
        return false
      if (filters.workModels.length > 0 && !filters.workModels.includes(job.workModel))
        return false
      if (filters.location && job.location !== filters.location && filters.location !== 'Remoto')
        return false
      if (filters.location === 'Remoto' && job.workModel !== 'remoto') return false
      return true
    })
  }, [filters])

  return (
    <div className="flex flex-col gap-6">
      <JobFilters
        filters={filters}
        onChange={setFilters}
        total={MOCK_JOBS.length}
        filtered={filteredJobs.length}
      />

      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 py-16 text-center">
          <BriefcaseBusiness className="h-10 w-10 text-zinc-700" />
          <p className="text-base font-medium text-zinc-400">Nenhuma vaga encontrada</p>
          <p className="text-sm text-zinc-600">Tente ajustar os filtros para ver mais resultados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}
