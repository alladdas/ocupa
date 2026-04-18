import Link from 'next/link'
import { ArrowRight, Bot, Bell, Zap, BarChart2, FileText, Star } from 'lucide-react'
import PricingCard from '@/components/PricingCard'
import Navbar from '@/components/Navbar'

const FREE_FEATURES = [
  'Browse de vagas em tempo real',
  'Filtros por área, senioridade, local e empresa',
  'Até 3 alertas por email por dia',
  'Push notifications via app (PWA)',
  'Acesso às vagas antes do LinkedIn',
]

const PRO_FEATURES = [
  'Tudo do plano Free',
  'Alertas ilimitados por email e push',
  'Auto-apply agent 24/7 — aplica automaticamente',
  'Currículo adaptado por IA para cada vaga',
  'Dashboard de pipeline de candidaturas',
  'Seleção automática do melhor currículo por vaga',
  'Suporte prioritário',
]

const TESTIMONIALS = [
  {
    name: 'Ana Souza',
    role: 'Product Designer',
    text: '8 entrevistas em 4 semanas sem preencher um formulário. O auto-apply mudou minha vida.',
    rating: 5,
  },
  {
    name: 'Carlos Lima',
    role: 'Software Engineer',
    text: 'Fui chamado para entrevista na Nubank 2 horas depois da vaga ser publicada. Antes do LinkedIn.',
    rating: 5,
  },
  {
    name: 'Fernanda Rocha',
    role: 'Data Analyst',
    text: 'O currículo adaptado faz diferença real. Minha taxa de resposta triplicou.',
    rating: 5,
  },
]

const HOW_IT_WORKS = [
  {
    icon: <FileText className="h-6 w-6" />,
    title: 'Suba seu currículo',
    description: 'Faça upload do seu PDF. A IA extrai e estrutura seus dados em segundos.',
  },
  {
    icon: <Bell className="h-6 w-6" />,
    title: 'Configure seus alertas',
    description: 'Escolha áreas, senioridade e empresas. Configure em 60 segundos.',
  },
  {
    icon: <Bot className="h-6 w-6" />,
    title: 'Deixa o bot trabalhar',
    description: 'Quando uma vaga com match aparecer, o bot aplica com seu currículo adaptado.',
  },
]

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-zinc-950">
      {/* Header */}
      <section className="border-b border-zinc-800/60 bg-gradient-to-b from-zinc-900 to-zinc-950 px-4 py-14 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-medium text-violet-400">
            <Zap className="h-3.5 w-3.5" />
            Sem cartão de crédito para começar
          </div>
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Planos simples,{' '}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              resultados reais
            </span>
          </h1>
          <p className="text-lg text-zinc-400">
            Comece grátis. Upgrade quando quiser mais entrevistas por semana.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="mx-auto max-w-4xl px-4 py-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <PricingCard
            name="Free"
            price="R$0"
            period=""
            description="Para quem quer começar a monitorar vagas sem custo."
            features={FREE_FEATURES}
            cta="Começar grátis"
            ctaHref="/onboarding"
          />
          <PricingCard
            name="Pro"
            price="R$14,90"
            period="semana"
            description="Para quem está em modo urgência e quer o máximo de entrevistas."
            features={PRO_FEATURES}
            cta="Ativar Auto-Apply"
            ctaHref="/onboarding"
            highlighted
            badge="Mais popular"
          />
        </div>

        {/* Pricing context */}
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-center">
          <p className="text-sm text-zinc-400">
            <span className="font-semibold text-white">Por que semanal?</span> Quem procura emprego
            está em modo urgência por 4-8 semanas. R$14,90/semana é menos que um café por dia —
            e você cancela quando conseguir a vaga.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-zinc-800/60 bg-zinc-900/30 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-white md:text-3xl">
            Como funciona
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.title}
                className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
                    {step.icon}
                  </span>
                  <span className="text-2xl font-bold text-zinc-700">0{i + 1}</span>
                </div>
                <div>
                  <h3 className="mb-1 text-base font-semibold text-white">{step.title}</h3>
                  <p className="text-sm text-zinc-500">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-t border-zinc-800/60 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-2xl font-bold text-white">
            O que dizem nossos usuários
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-auto">
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-zinc-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live stats */}
      <section className="border-t border-zinc-800/60 bg-zinc-900/30 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { icon: <BarChart2 className="h-5 w-5" />, value: '2.840+', label: 'Vagas esta semana' },
              { icon: <Bot className="h-5 w-5" />, value: '1.204', label: 'Aplicações automáticas' },
              { icon: <Bell className="h-5 w-5" />, value: '8.430', label: 'Alertas enviados' },
              { icon: <Zap className="h-5 w-5" />, value: '50+', label: 'Empresas monitoradas' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-center"
              >
                <span className="text-violet-400">{stat.icon}</span>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-16 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="mb-3 text-3xl font-bold text-white">
            Pronto para ocupar sua próxima vaga?
          </h2>
          <p className="mb-8 text-zinc-400">
            Comece grátis agora. Upgrade para o Pro quando quiser turbinar.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-violet-500"
          >
            Começar grátis — sem cartão
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
    </>
  )
}
