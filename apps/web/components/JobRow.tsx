'use client'

import { useState } from 'react'
import { Lock, Share2, EyeOff, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { cn, getCompanyColor, getCompanyInitials } from '@/lib/utils'
import FreshBadge from '@/components/FreshBadge'
import { useAuthModal } from '@/components/AuthModalContext'
import { useUser } from '@/components/UserContext'
import { useUpgradeModal } from '@/components/UpgradeModalContext'
import type { Job } from '@/lib/mock-data'

interface JobRowProps {
  job: Job
}

function CompanyLogo({ job }: { job: Job }) {
  const [imgFailed, setImgFailed] = useState(false)
  const initials = getCompanyInitials(job.company)
  const colorClass = getCompanyColor(job.companySlug)

  if (job.logoUrl && !imgFailed) {
    return (
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white"
        style={{ borderColor: 'var(--d-border)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={job.logoUrl}
          alt={job.company}
          className="h-8 w-8 object-contain"
          onError={() => setImgFailed(true)}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white',
        colorClass
      )}
    >
      {initials}
    </div>
  )
}

type BadgeColor = 'green' | 'blue' | 'yellow' | 'purple'
interface Badge { label: string; color: BadgeColor; pulse?: boolean }

function getContextBadges(job: Job): Badge[] {
  const badges: Badge[] = []
  const hoursOld = (Date.now() - job.detectedAt.getTime()) / 3_600_000
  if (hoursOld < 6) badges.push({ label: 'Nova', color: 'green', pulse: true })
  if (job.salary) badges.push({ label: 'Salário visível', color: 'blue' })
  const text = (job.title + ' ' + job.description).toLowerCase()
  if (/pcd|pessoa com defici[eê]ncia/.test(text)) badges.push({ label: 'PCD', color: 'yellow' })
  if (job.workModel === 'remoto') badges.push({ label: 'Remoto', color: 'purple' })
  return badges.slice(0, 3)
}

const BADGE_STYLES: Record<BadgeColor, { bg: string; color: string; border: string }> = {
  green:  { bg: 'var(--d-accent-subtle)',  color: 'var(--d-accent-text)',  border: 'var(--d-accent-border)' },
  blue:   { bg: 'rgba(59,130,246,0.1)',    color: '#3b82f6',               border: 'rgba(59,130,246,0.3)' },
  yellow: { bg: 'rgba(234,179,8,0.1)',     color: '#ca8a04',               border: 'rgba(234,179,8,0.3)' },
  purple: { bg: 'rgba(168,85,247,0.1)',    color: '#a855f7',               border: 'rgba(168,85,247,0.3)' },
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\bon\w+\s*=/gi, 'data-removed=')
}

export default function JobRow({ job }: JobRowProps) {
  const [expanded, setExpanded] = useState(false)
  const { openAuthModal } = useAuthModal()
  const { openUpgradeModal } = useUpgradeModal()
  const { user } = useUser()

  const handleApply = user ? openUpgradeModal : openAuthModal
  const badges = getContextBadges(job)

  return (
    <div
      className="border-b transition-colors"
      style={{ borderColor: 'var(--d-border)' }}
    >
      {/* Main row */}
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
        onClick={() => setExpanded((v) => !v)}
      >
        <CompanyLogo job={job} />

        {/* Job info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="truncate text-sm font-semibold"
              style={{ color: 'var(--d-text)' }}
            >
              {job.title}
            </span>
            {badges.map((badge) => {
              const s = BADGE_STYLES[badge.color]
              return (
                <span
                  key={badge.label}
                  className="font-mono-dm inline-flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                >
                  {badge.pulse && (
                    <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: s.color }} />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                    </span>
                  )}
                  {badge.label}
                </span>
              )
            })}
          </div>
          <div
            className="font-mono-dm mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]"
            style={{ color: 'var(--d-text-2)' }}
          >
            <span>{job.company}</span>
            <span style={{ color: 'var(--d-muted)' }}>·</span>
            <span>{job.location}</span>
            <span
              className="rounded px-1.5 py-0.5"
              style={{ background: 'var(--d-tag-bg)', color: 'var(--d-text-2)' }}
            >
              {job.workModel}
            </span>
            {job.salary && (
              <>
                <span style={{ color: 'var(--d-muted)' }}>·</span>
                <span>{job.salary}</span>
              </>
            )}
          </div>
        </div>

        {/* Right actions — stopPropagation so clicks don't expand the row */}
        <div
          className="flex flex-shrink-0 items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <FreshBadge detectedAt={job.detectedAt} />

          <button
            className="rounded-md p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: 'var(--d-muted)' }}
            title="Não tenho interesse"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>

          <button
            className="rounded-md p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: 'var(--d-muted)' }}
            title="Compartilhar"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>

          {/* Apply button — auth modal if guest, upgrade modal if free-tier user */}
          <button
            className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-90 sm:flex"
            style={{
              background: 'var(--d-accent-subtle)',
              color: 'var(--d-accent-text)',
              border: '1px solid var(--d-accent-border)',
            }}
            onClick={handleApply}
          >
            {!user && <Lock className="h-3 w-3" />}
            Aplicar por mim
          </button>

          <button
            className="rounded-md p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: 'var(--d-muted)' }}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          className="border-t px-4 py-4 pl-16"
          style={{ borderColor: 'var(--d-border)', background: 'var(--d-surface)' }}
        >
          {job.description ? (
            <div
              className="prose prose-sm mb-3 max-w-none text-sm leading-relaxed"
              style={{ color: 'var(--d-text-2)' }}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description) }}
            />
          ) : (
            <p className="mb-3 text-sm italic" style={{ color: 'var(--d-muted)' }}>
              Descrição não disponível.
            </p>
          )}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {job.tags.map((tag) => (
              <span
                key={tag}
                className="font-mono-dm rounded px-2 py-0.5 text-[11px]"
                style={{
                  background: 'var(--d-tag-bg)',
                  color: 'var(--d-text-2)',
                  border: '1px solid var(--d-border)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--d-accent)' }}
            >
              Ver vaga
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:opacity-90"
              style={{
                background: 'var(--d-accent-subtle)',
                color: 'var(--d-accent-text)',
                border: '1px solid var(--d-accent-border)',
              }}
            >
              {!user && <Lock className="h-3.5 w-3.5" />}
              Aplicar por mim
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
