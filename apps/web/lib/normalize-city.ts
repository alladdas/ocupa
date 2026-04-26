const COUNTRIES = new Set([
  'brasil', 'brazil', 'argentina', 'colombia', 'mexico', 'usa',
  'canada', 'france', 'spain', 'netherlands', 'germany', 'holanda',
  'united states', 'united kingdom', 'uk', 'uruguay', 'chile', 'peru',
])

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1))
}

export function normalizeCity(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.includes(';')) return null // multi-city entry

  const lower = trimmed.toLowerCase()
  if (/\bremot[eo]?\b|home.?office|work from home|100%\s*remot/.test(lower)) return 'Remoto'

  const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean)
  if (!parts.length) return null

  // Handle "Country, City" format (e.g. "Brasil, São Paulo" or "Brazil, Sao Paulo")
  let city = parts[0]
  if (COUNTRIES.has(stripAccents(parts[0]).toLowerCase())) {
    if (parts.length < 2) return null
    city = parts[1]
  }

  city = city.split(' - ')[0].split('/')[0].trim() // strip "City - STATE"
  city = city.split(' and ')[0].trim()              // strip Gupy trailing " and Hybrid..."

  const norm = stripAccents(city).toLowerCase()
  if (COUNTRIES.has(norm)) return null
  if (/^[a-z]{2}$/.test(norm)) return null // bare state code like "SP", "RJ"
  if (city.length < 2) return null

  return titleCase(city)
}
