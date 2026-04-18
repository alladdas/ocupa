'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
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
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)

  const PAGE_SIZE = 50

  const fetchJobs = useCallback((off: number, append: boolean) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    fetch(`/api/jobs?offset=${off}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          const jobs = (data as Job[]).map((j) => ({ ...j, detectedAt: new Date(j.detectedAt) }))
          setAllJobs((prev) => append ? [...prev, ...jobs] : jobs)
          setHasMore(jobs.length === PAGE_SIZE)
          setOffset(off + jobs.length)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (append) setLoadingMore(false)
        else setLoading(false)
      })
  }, [PAGE_SIZE])

  useEffect(() => { fetchJobs(0, false) }, [fetchJobs])

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
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={() => fetchJobs(offset, true)}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
      </div>
    </div>
  )
}
