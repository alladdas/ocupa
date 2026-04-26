// Countries/regions that indicate a foreign (non-BR) location.
// Used to reject the last segment of "City, State, Country" format.
const FOREIGN_REGIONS = new Set([
  // Countries
  'united states', 'usa', 'us', 'canada', 'united kingdom', 'uk', 'great britain',
  'france', 'spain', 'netherlands', 'germany', 'holanda', 'argentina', 'colombia',
  'mexico', 'uruguay', 'chile', 'peru', 'japan', 'india', 'singapore', 'australia',
  'israel', 'ireland', 'italy', 'portugal', 'russia', 'china', 'south korea',
  'sweden', 'norway', 'denmark', 'switzerland', 'austria', 'poland', 'belgium',
  // US states (long form) — appear as last segment in US city formats
  'california', 'new york', 'washington', 'texas', 'florida', 'illinois',
  'pennsylvania', 'ohio', 'georgia', 'north carolina', 'michigan', 'virginia',
  'arizona', 'tennessee', 'colorado', 'utah', 'oregon', 'indiana', 'nevada',
  'massachusetts', 'connecticut', 'minnesota', 'wisconsin', 'missouri',
  // Canadian provinces
  'ontario', 'british columbia', 'quebec', 'alberta',
  // UK regions
  'england', 'scotland', 'wales', 'northern ireland',
])

// US-only 2-letter state codes (no overlap with Brazilian state abbreviations).
// Catches "City, CA" or "City, NY" format.
const US_ONLY_STATES = new Set([
  'ak','az','ca','co','ct','de','fl','ga','hi','ia','id',
  'il','in','ks','ky','la','md','me','mi','mn','mo','mt',
  'nc','nd','ne','nh','nj','nm','nv','ny','oh','ok','or',
  'ri','sd','tn','tx','ut','va','vt','wa','wi','wv','wy','dc',
])

// Work model strings that look like locations but are not cities
const WORK_MODEL_RE = /\bremot[eo]?\b|\bhybrid\b|\bhíbrid[ao]?\b|\bhibrid[ao]?\b|\bvirtual\b|\bpresencial\b|\bon-?site\b|\bworldwide\b|\banywhere\b|home.?office|work from home/i

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1))
}

export function normalizeCity(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.includes(';') || trimmed.includes('•')) return null // multi-city
  if (trimmed.includes('(')) return null                          // gympass ambiguous format

  if (WORK_MODEL_RE.test(trimmed)) return null

  const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean)
  if (!parts.length) return null

  // Reject if last segment is a foreign country or US state (long form)
  const lastNorm = stripAccents(parts[parts.length - 1]).toLowerCase()
  if (FOREIGN_REGIONS.has(lastNorm)) return null

  // Handle "Brasil/Brazil, City" → extract city from second segment
  let city = parts[0]
  const firstNorm = stripAccents(parts[0]).toLowerCase()
  if (firstNorm === 'brasil' || firstNorm === 'brazil') {
    if (parts.length < 2) return null
    city = parts[1]
  } else if (FOREIGN_REGIONS.has(firstNorm)) {
    return null
  }

  // Reject if second segment is a US-only state code: "San Francisco, CA"
  if (parts.length >= 2) {
    const secondNorm = stripAccents(parts[1]).toLowerCase()
    if (US_ONLY_STATES.has(secondNorm)) return null
  }

  city = city.split(' - ')[0].split('/')[0].trim() // strip "City - STATE"
  city = city.split(' and ')[0].trim()              // strip Gupy trailing " and Hybrid..."

  const norm = stripAccents(city).toLowerCase()
  if (FOREIGN_REGIONS.has(norm)) return null
  if (/^[a-z]{2}$/.test(norm)) return null // bare state code like "SP", "RJ"
  if (city.length < 2) return null

  return titleCase(city)
}
