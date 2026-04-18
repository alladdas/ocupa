'use client'

import Link from 'next/link'
import { MapPin, Clock, Zap, ExternalLink } from 'lucide-react'
import { cn, timeAgo, getCompanyColor, getCompanyInitials } from '@/lib/utils'
import type { Job } from '@/lib/mock-data'

const WORK_MODEL_STYLES: Record<string, string> = {
  remoto: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  híbrido: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  presencial: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

const SENIORITY_STYLES: Record<string, string> = {
  Júnior: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  Pleno: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  Sênior: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Lead: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
}

interface JobCardProps {
  job: Job
}

export default function JobCard({ job }: JobCardProps) {
  const companyColor = getCompanyColor(job.companySlug)
  const initials = getCompanyInitials(job.company)
  const postedTime = timeAgo(job.detectedAt)
  const isNew = Date.now() - job.detectedAt.getTime() < 60 * 60 * 1000 // < 1h

  return (
    <div className="group relative flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-800/80">
      {/* Top row: logo + company + badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Company logo / initials */}
          <div
            className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-lg',
              companyColor
            )}
          >
            {initials}
          </div>

          <div>
            <p className="text-sm font-medium text-zinc-400">{job.company}</p>
            <h3 className="text-base font-semibold text-white leading-tight">
              {job.title}
            </h3>
          </div>
        </div>

        {/* New / Not on LinkedIn badge */}
        <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
          {isNew && (
            <span className="flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-400 border border-violet-500/20">
              <Zap className="h-3 w-3" />
              Nova
            </span>
          )}
          {!job.isOnLinkedin && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              Não está no LinkedIn
            </span>
          )}
        </div>
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
        <span className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" />
          {job.location}
        </span>
        <span className="text-zinc-700">·</span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {postedTime}
        </span>
        {job.salary && (
          <>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-400">{job.salary}</span>
          </>
        )}
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-2">
        <span
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-xs font-medium',
            WORK_MODEL_STYLES[job.workModel]
          )}
        >
          {job.workModel.charAt(0).toUpperCase() + job.workModel.slice(1)}
        </span>
        <span
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-xs font-medium',
            SENIORITY_STYLES[job.seniority]
          )}
        >
          {job.seniority}
        </span>
        <span className="rounded-full border border-zinc-700/50 bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
          {job.area}
        </span>
      </div>

      {/* Tags */}
      {job.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500 group-hover:border-zinc-700"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
        <Link
          href="/onboarding"
          className="text-xs font-medium text-zinc-500 transition-colors hover:text-violet-400"
        >
          Criar alerta para vagas assim →
        </Link>
        <Link
          href={job.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-500"
        >
          Ver vaga
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}
