import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Navbar from '@/components/Navbar'

export default function OnboardingPage() {
  return (
    <>
      <Navbar />
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/20">
            <span className="text-3xl">🚀</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-white">Em breve!</h1>
          <p className="mb-6 text-sm text-zinc-400">
            O onboarding está sendo construído. Volte em breve para criar seu perfil e começar a
            receber alertas de vagas personalizados.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-violet-400 transition-colors hover:text-violet-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para as vagas
          </Link>
        </div>
      </main>
    </>
  )
}
