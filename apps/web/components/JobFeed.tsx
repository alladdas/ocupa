'use client'

import { useState } from 'react'
import { SlidersHorizontal, CheckCircle, FileText, Bell, Bot, ArrowRight } from 'lucide-react'
import JobRow from '@/components/JobRow'
import { useAuthModal } from '@/components/AuthModalContext'
import { useUser } from '@/components/UserContext'
import type { Job } from '@/lib/mock-data'

interface JobFeedProps {
  jobs: Job[]
  total: number
  loading?: boolean
  onToggleSidebar: () => void
}

const ONBOARDING_STEPS = [
  {
    id: 'resume',
    Icon: FileText,
    title: 'Suba seu currículo',
    description: 'PDF ou LinkedIn — a IA extrai seus dados',
    done: false,
  },
  {
    id: 'alerts',
    Icon: Bell,
    title: 'Configure seus alertas',
    description: 'Área, senioridade e empresas favoritas',
    done: false,
  },
  {
    id: 'auto',
    Icon: Bot,
    title: 'Ative o Auto-Apply',
    description: 'Plano Pro — aplica 24/7 enquanto você dorme',
    done: false,
  },
]

function SkeletonRow() {
  return (
    <div
      className="flex items-center gap-3 border-b px-4 py-3"
      style={{ borderColor: 'var(--d-border)' }}
    >
      <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-lg" style={{ background: 'var(--d-border)' }} />
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="h-3 w-48 animate-pulse rounded" style={{ background: 'var(--d-border)' }} />
        <div className="h-2.5 w-32 animate-pulse rounded" style={{ background: 'var(--d-border)' }} />
      </div>
      <div className="hidden h-2.5 w-16 animate-pulse rounded sm:block" style={{ background: 'var(--d-border)' }} />
    </div>
  )
}

export default function JobFeed({ jobs, total, loading = false, onToggleSidebar }: JobFeedProps) {
  const [activeTab, setActiveTab] = useState<'vagas' | 'ignoradas'>('vagas')
  const [lastScanMin] = useState(3)
  const { openAuthModal } = useAuthModal()
  const { user } = useUser()

  const steps = ONBOARDING_STEPS.map((s) => ({
    ...s,
    // Mark "Configure seus alertas" as done once user signs up
    done: s.id === 'alerts' ? !!user : s.done,
  }))

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ background: 'var(--d-bg)' }}>
      {/* Feed header */}
      <div
        className="flex h-[52px] flex-shrink-0 items-center justify-between border-b px-4"
        style={{ background: 'var(--d-nav)', borderColor: 'var(--d-border)' }}
      >
        <div className="flex items-center gap-3">
          {/* Mobile sidebar toggle */}
          <button
            onClick={onToggleSidebar}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/10 sm:hidden"
            style={{ color: 'var(--d-text-2)' }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros
          </button>

          {/* LIVE indicator */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ background: 'var(--d-accent)' }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: 'var(--d-accent)' }}
              />
            </span>
            <span
              className="font-mono-dm text-[11px] font-semibold"
              style={{ color: 'var(--d-accent)' }}
            >
              LIVE
            </span>
          </div>

          <span
            className="font-mono-dm hidden text-[11px] sm:inline"
            style={{ color: 'var(--d-muted)' }}
          >
            Último scan: {lastScanMin}m atrás
          </span>
        </div>

        {/* Match counter */}
        {loading ? (
          <div className="h-2.5 w-24 animate-pulse rounded" style={{ background: 'var(--d-border)' }} />
        ) : (
          <span className="font-mono-dm text-[11px]" style={{ color: 'var(--d-text-2)' }}>
            <span className="font-semibold" style={{ color: 'var(--d-accent)' }}>
              {jobs.length}
            </span>
            {jobs.length !== total && (
              <span style={{ color: 'var(--d-muted)' }}> de {total}</span>
            )}{' '}
            vagas com match
          </span>
        )}
      </div>

      {/* Tabs */}
      <div
        className="flex flex-shrink-0 border-b"
        style={{ background: 'var(--d-nav)', borderColor: 'var(--d-border)' }}
      >
        {[
          { id: 'vagas', label: 'Vagas' },
          { id: 'ignoradas', label: 'Não tenho interesse' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className="relative px-5 py-2.5 text-xs font-medium transition-colors"
            style={{
              color: activeTab === tab.id ? 'var(--d-text)' : 'var(--d-muted)',
              borderBottom:
                activeTab === tab.id
                  ? '2px solid var(--d-accent)'
                  : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {/* Onboarding checklist */}
        <div
          className="border-b px-4 py-4"
          style={{
            borderColor: 'var(--d-border)',
            background: 'var(--d-accent-bg)',
          }}
        >
          <p
            className="mb-3 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--d-muted)' }}
          >
            Configure sua conta
          </p>
          <div className="flex flex-col">
            {steps.map((step, i) => {
              const isLast = i === ONBOARDING_STEPS.length - 1
              const { Icon } = step
              return (
                <div key={step.id} className="flex gap-3">
                  {/* Step circle + vertical line */}
                  <div className="flex flex-col items-center">
                    <div
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                      style={{
                        borderColor: step.done ? 'var(--d-accent)' : 'var(--d-border)',
                        background: step.done ? 'var(--d-accent)' : 'transparent',
                      }}
                    >
                      {step.done ? (
                        <CheckCircle className="h-3.5 w-3.5 text-white" />
                      ) : (
                        <span
                          className="font-mono-dm text-[9px] font-bold"
                          style={{ color: 'var(--d-muted)' }}
                        >
                          {i + 1}
                        </span>
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className="min-h-[14px] w-0.5 flex-1"
                        style={{ background: 'var(--d-border)' }}
                      />
                    )}
                  </div>

                  {/* Step text */}
                  <div className={`${isLast ? 'pb-0' : 'pb-3'}`}>
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" style={{ color: 'var(--d-accent)' }} />
                      <span
                        className="text-xs font-semibold"
                        style={{ color: 'var(--d-text)' }}
                      >
                        {step.title}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px]" style={{ color: 'var(--d-muted)' }}>
                      {step.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* CTA — changes based on auth state */}
          <button
            onClick={openAuthModal}
            className="font-mono-dm mt-4 flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--d-accent)' }}
          >
            {user ? 'Subir currículo' : 'Criar alerta grátis'}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Job rows */}
        {activeTab === 'vagas' && (
          <div>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : (
              <>
                {jobs.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
                {jobs.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16">
                    <p className="text-sm" style={{ color: 'var(--d-muted)' }}>
                      Nenhuma vaga encontrada com esses filtros.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'ignoradas' && (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm" style={{ color: 'var(--d-muted)' }}>
              Nenhuma vaga ignorada ainda.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
