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

export default function JobRow({ job }: JobRowProps) {
  const [expanded, setExpanded] = useState(false)
  const { openAuthModal } = useAuthModal()
  const { openUpgradeModal } = useUpgradeModal()
  const { user } = useUser()

  const handleApply = user ? openUpgradeModal : openAuthModal

  const initials = getCompanyInitials(job.company)
  const colorClass = getCompanyColor(job.companySlug)

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
        {/* Company logo */}
        <div
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white',
            colorClass
          )}
        >
          {initials}
        </div>

        {/* Job info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="truncate text-sm font-semibold"
              style={{ color: 'var(--d-text)' }}
            >
              {job.title}
            </span>
            {!job.isOnLinkedin && (
              <span
                className="font-mono-dm flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  background: 'var(--d-accent-subtle)',
                  color: 'var(--d-accent-text)',
                  border: '1px solid var(--d-accent-border)',
                }}
              >
                Fora do LinkedIn
              </span>
            )}
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
          <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--d-text-2)' }}>
            {job.description}
          </p>
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
