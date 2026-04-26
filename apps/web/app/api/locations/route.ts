export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeCity, stripAccents } from '@/lib/normalize-city'
import { MANDATORY_CLAUSE } from '@/lib/jobs-filter'

// Minimum job count for a city to appear in the filter
const DEFAULT_MIN = 5

// Server-side in-memory cache (resets on cold start)
const CACHE_TTL_MS = 10 * 60 * 1000

interface CityEntry { name: string; count: number }
let cachedCities: CityEntry[] | null = null
let cacheTs = 0

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const minCount = parseInt(searchParams.get('min') ?? String(DEFAULT_MIN), 10)
  const fresh = searchParams.get('fresh') === 'true'

  const now = Date.now()
  if (!fresh && cachedCities && now - cacheTs < CACHE_TTL_MS) {
    return NextResponse.json(buildResponse(cachedCities, minCount))
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  // Fetch all matching locations in batches (PostgREST default limit is 1000)
  const allLocs: string[] = []
  let offset = 0
  const BATCH = 1000
  while (true) {
    const { data, error } = await supabase
      .from('scraped_jobs')
      .select('location')
      .or(MANDATORY_CLAUSE)
      .not('location', 'is', null)
      .neq('location', '')
      .range(offset, offset + BATCH - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    for (const row of data ?? []) {
      if (row.location) allLocs.push(row.location as string)
    }
    if ((data?.length ?? 0) < BATCH) break
    offset += BATCH
  }

  // Normalize each location and aggregate by accent-stripped key
  // so "São Paulo" and "Sao Paulo" collapse into the same city.
  // Canonical name = the most frequent variant (keeps proper accents).
  const groups = new Map<string, Map<string, number>>()
  for (const loc of allLocs) {
    const city = normalizeCity(loc)
    if (!city) continue
    const key = stripAccents(city).toLowerCase()
    if (!groups.has(key)) groups.set(key, new Map())
    const variants = groups.get(key)!
    variants.set(city, (variants.get(city) ?? 0) + 1)
  }

  const allCities: CityEntry[] = []
  for (const [, variants] of groups) {
    let canonical = ''
    let maxVariantCount = 0
    let total = 0
    for (const [name, cnt] of variants) {
      total += cnt
      if (cnt > maxVariantCount) { maxVariantCount = cnt; canonical = name }
    }
    allCities.push({ name: canonical, count: total })
  }

  // Remoto first, then by count DESC
  allCities.sort((a, b) => {
    if (a.name === 'Remoto') return -1
    if (b.name === 'Remoto') return 1
    return b.count - a.count
  })

  cachedCities = allCities
  cacheTs = now

  return NextResponse.json(buildResponse(allCities, minCount))
}

function buildResponse(cities: CityEntry[], minCount: number) {
  const above = cities.filter(c => c.count >= minCount)
  const below = cities.filter(c => c.count < minCount)
  return {
    cities: above,
    total_cities_above_threshold: above.length,
    total_cities_below_threshold: below.length,
  }
}
