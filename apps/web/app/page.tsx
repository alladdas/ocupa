'use client'

import { useState, useMemo, useEffect } from 'react'
import DashNav from '@/components/DashNav'
import FilterSidebar from '@/components/FilterSidebar'
import JobFeed from '@/components/JobFeed'
import type { Job } from '@/lib/mock-data'
import type { Filters } from '@/components/JobFilters'

const DEFAULT_FILTERS: Filters = {
  search: '',
  areas: [],
  seniorities: [],
  workModels: [],
  location: '',
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [allJobs, setAllJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/jobs')
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setAllJobs(
            (data as Job[]).map((j) => ({ ...j, detectedAt: new Date(j.detectedAt) }))
          )
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filteredJobs = useMemo(() => {
    return allJobs.filter((job) => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const hit =
          job.title.toLowerCase().includes(q) ||
          job.company.toLowerCase().includes(q) ||
          job.tags.some((t) => t.toLowerCase().includes(q))
        if (!hit) return false
      }
      if (filters.areas.length > 0 && !filters.areas.includes(job.area)) return false
      if (filters.seniorities.length > 0 && !filters.seniorities.includes(job.seniority))
        return false
      if (filters.workModels.length > 0 && !filters.workModels.includes(job.workModel))
        return false
      if (
        filters.location &&
        job.location !== filters.location &&
        job.workModel !== 'remoto'
      )
        return false
      return true
    })
  }, [filters, allJobs])

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ background: 'var(--d-bg)' }}
    >
      <DashNav />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <FilterSidebar filters={filters} onChange={setFilters} />}
        <JobFeed
          jobs={filteredJobs}
          total={allJobs.length}
          loading={loading}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
      </div>
    </div>
  )
}
