'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import DashNav from '@/components/DashNav'
import FilterSidebar from '@/components/FilterSidebar'
import JobFeed from '@/components/JobFeed'
import { useUser } from '@/components/UserContext'
import { loadHiddenIds, hideJobRemote, unhideJobRemote } from '@/lib/preferences'
import type { Job } from '@/lib/mock-data'
import type { Filters } from '@/components/JobFilters'

const DEFAULT_FILTERS: Filters = {
  search: '',
  areas: [],
  seniorities: [],
  workModels: [],
  location: '',
}

const PAGE_SIZE = 50

function buildUrl(off: number, f: Filters): string {
  const p = new URLSearchParams({ offset: String(off) })
  if (f.search) p.set('search', f.search)
  f.areas.forEach((a) => p.append('area', a))
  f.seniorities.forEach((s) => p.append('seniority', s))
  f.workModels.forEach((m) => p.append('workModel', m))
  if (f.location) p.set('location', f.location)
  return `/api/jobs?${p}`
}

function readLocalHiddenIds(): Set<string> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('hidden_jobs') : null
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set<string>()
  }
}

function saveLocalHiddenIds(ids: Set<string>): void {
  try {
    localStorage.setItem('hidden_jobs', JSON.stringify(Array.from(ids)))
  } catch { /* storage unavailable */ }
}

export default function DashboardPage() {
  const { user } = useUser()
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [hiddenJobs, setHiddenJobs] = useState<Job[]>([])
  const hiddenIdsRef = useRef<Set<string>>(readLocalHiddenIds())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref so hideJob/unhideJob callbacks don't need user in their dep array
  const userIdRef = useRef<string | null>(null)
  userIdRef.current = user?.id ?? null

  // When user logs in, merge their Supabase hidden IDs into the local set
  // and immediately re-filter any already-loaded jobs
  useEffect(() => {
    if (!user?.id) return
    loadHiddenIds(user.id).then((serverIds) => {
      let changed = false
      serverIds.forEach((id) => {
        if (!hiddenIdsRef.current.has(id)) {
          hiddenIdsRef.current.add(id)
          changed = true
        }
      })
      if (changed) {
        saveLocalHiddenIds(hiddenIdsRef.current)
        setJobs((prev) => prev.filter((j) => !hiddenIdsRef.current.has(j.id)))
      }
    })
  }, [user?.id])

  const applyFetch = useCallback((off: number, append: boolean, currentFilters: Filters) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    fetch(buildUrl(off, currentFilters), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          const fetched = (data as Job[]).map((j) => ({ ...j, detectedAt: new Date(j.detectedAt) }))
          const visible = fetched.filter((j) => !hiddenIdsRef.current.has(j.id))
          setJobs((prev) => (append ? [...prev, ...visible] : visible))
          setHasMore(fetched.length === PAGE_SIZE)
          setOffset(off + fetched.length)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (append) setLoadingMore(false)
        else setLoading(false)
      })
  }, [])

  // Debounced re-fetch on filter change
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setJobs([])
      setOffset(0)
      setHasMore(true)
      applyFetch(0, false, filters)
    }, 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [filters, applyFetch])

  const hideJob = useCallback((job: Job) => {
    hiddenIdsRef.current.add(job.id)
    saveLocalHiddenIds(hiddenIdsRef.current)
    if (userIdRef.current) {
      hideJobRemote(userIdRef.current, job.id)
    }
    setJobs((prev) => prev.filter((j) => j.id !== job.id))
    setHiddenJobs((prev) => [job, ...prev])
  }, [])

  const unhideJob = useCallback((jobId: string) => {
    hiddenIdsRef.current.delete(jobId)
    saveLocalHiddenIds(hiddenIdsRef.current)
    if (userIdRef.current) {
      unhideJobRemote(userIdRef.current, jobId)
    }
    setHiddenJobs((prev) => prev.filter((j) => j.id !== jobId))
  }, [])

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ background: 'var(--d-bg)' }}
    >
      <DashNav />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <FilterSidebar filters={filters} onChange={setFilters} />}
        <JobFeed
          jobs={jobs}
          total={jobs.length}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          hiddenJobs={hiddenJobs}
          onLoadMore={() => applyFetch(offset, true, filters)}
          onHide={hideJob}
          onUnhide={unhideJob}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
      </div>
    </div>
  )
}
