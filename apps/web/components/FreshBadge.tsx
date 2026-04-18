import { timeAgo } from '@/lib/utils'

interface FreshBadgeProps {
  detectedAt: Date
  className?: string
}

function getFreshness(date: Date): 'warm' | 'cool' | 'stale' {
  const hours = (Date.now() - date.getTime()) / 3600000
  if (hours < 6) return 'warm'
  if (hours < 24) return 'cool'
  return 'stale'
}

export default function FreshBadge({ detectedAt, className = '' }: FreshBadgeProps) {
  const freshness = getFreshness(detectedAt)
  const timeStr = timeAgo(detectedAt)

  if (freshness === 'warm') {
    return (
      <span
        className={`font-mono-dm inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}
        style={{
          background: 'var(--d-accent-subtle)',
          color: 'var(--d-accent-text)',
          border: '1px solid var(--d-accent-border)',
        }}
      >
        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ background: 'var(--d-accent)' }}
          />
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--d-accent)' }}
          />
        </span>
        {timeStr}
      </span>
    )
  }

  if (freshness === 'cool') {
    return (
      <span
        className={`font-mono-dm inline-flex items-center text-[11px] font-medium ${className}`}
        style={{ color: '#d97706' }}
      >
        {timeStr}
      </span>
    )
  }

  return (
    <span
      className={`font-mono-dm inline-flex items-center text-[11px] ${className}`}
      style={{ color: 'var(--d-muted)' }}
    >
      {timeStr}
    </span>
  )
}
