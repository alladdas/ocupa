import type { Metadata, Viewport } from 'next'
import { Inter, DM_Mono } from 'next/font/google'
import './globals.css'
import ThemeProvider from '@/components/ThemeProvider'
import { UserProvider } from '@/components/UserContext'
import Providers from '@/components/Providers'

const inter = Inter({ subsets: ['latin'] })
const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
})

export const viewport: Viewport = {
  themeColor: '#f6f8f7',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'Ocupa — Vagas em tempo real + Auto-Apply com IA',
  description:
    'Monitore Nubank, iFood e +50 empresas. Seja avisado antes de todo mundo. Auto-apply com currículo adaptado por IA.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Ocupa — Vagas em tempo real + Auto-Apply com IA',
    description:
      'Monitore Nubank, iFood e +50 empresas. Seja avisado antes de todo mundo.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Inline script: apply saved theme before first paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('ocupa-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.className} ${dmMono.variable} antialiased`}>
        <ThemeProvider>
          <UserProvider>
            <Providers>{children}</Providers>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
