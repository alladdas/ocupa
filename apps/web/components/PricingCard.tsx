import Link from 'next/link'
import { Check, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PricingCardProps {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  ctaHref: string
  highlighted?: boolean
  badge?: string
}

export default function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  ctaHref,
  highlighted = false,
  badge,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border p-7 transition-all',
        highlighted
          ? 'border-violet-500/50 bg-zinc-900 shadow-[0_0_40px_rgba(139,92,246,0.15)]'
          : 'border-zinc-800 bg-zinc-900/60'
      )}
    >
      {badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">
            <Zap className="h-3 w-3" />
            {badge}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          {name}
        </p>
        <div className="flex items-end gap-1">
          <span
            className={cn(
              'text-4xl font-bold tracking-tight',
              highlighted ? 'text-white' : 'text-zinc-200'
            )}
          >
            {price}
          </span>
          {period && (
            <span className="mb-1 text-sm text-zinc-500">/{period}</span>
          )}
        </div>
        <p className="mt-2 text-sm text-zinc-500">{description}</p>
      </div>

      {/* Features */}
      <ul className="mb-8 flex flex-col gap-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-zinc-300">
            <Check
              className={cn(
                'mt-0.5 h-4 w-4 flex-shrink-0',
                highlighted ? 'text-violet-400' : 'text-zinc-500'
              )}
            />
            {feature}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <div className="mt-auto">
        <Link
          href={ctaHref}
          className={cn(
            'block w-full rounded-xl py-3 text-center text-sm font-semibold transition-colors',
            highlighted
              ? 'bg-violet-600 text-white hover:bg-violet-500'
              : 'border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
          )}
        >
          {cta}
        </Link>
      </div>
    </div>
  )
}
