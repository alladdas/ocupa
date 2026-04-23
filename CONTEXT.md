# Ocupa — Contexto Completo do Projeto

> Documento de referência para onboarding de desenvolvedores e continuação de conversas com IA.  
> Última atualização: 2026-04-23

---

## 1. O Que É o Produto

**Ocupa** é uma plataforma brasileira de monitoramento de vagas em tempo real com auto-apply por IA.

### Proposta de Valor
- Agrega vagas de +50 empresas brasileiras de tecnologia em um único feed
- Detecta novas vagas antes de qualquer job board generalista (Glassdoor, LinkedIn, etc.)
- Aplica automaticamente às vagas em nome do usuário, com currículo adaptado por IA para cada posição

### Diferenciais
- **Velocidade**: scrapers rodam a cada 30 minutos; vagas novas são exibidas com badge pulsante
- **Qualidade de empresas**: foco em tech/fintechs brasileiras de referência (Nubank, iFood, Stone, etc.)
- **Auto-apply**: diferencial principal — o usuário não precisa aplicar manualmente
- **Filtros por área/senioridade**: inferidos do título da vaga via pattern matching

---

## 2. Modelo de Negócio

| Plano | Preço | Recursos |
|-------|-------|----------|
| **Free** | R$0 | Feed completo, filtros, 3 alertas/dia por email |
| **Pro** | R$14,90/semana | Tudo do Free + Auto-apply 24/7, currículo adaptado por IA, alertas ilimitados, pipeline de candidaturas, suporte prioritário |

Pagamento via Stripe (ainda não integrado — placeholder em `/checkout`).

---

## 3. Stack Técnica

### Frontend
- **Next.js 14** (App Router, server + client components)
- **TypeScript**
- **Tailwind CSS 3** (dark mode via classe `dark`)
- **Supabase Auth** com Google OAuth e Magic Link (OTP por email)
- **`@supabase/ssr` v0.10** para gerenciamento de sessão com cookies
- **Lucide React** para ícones
- Deploy: **Vercel**

### Backend / Scrapers
- **Python 3.11+**
- Bibliotecas: `supabase`, `requests`, `schedule`, `python-dotenv`
- 3 scrapers: Gupy portal, Greenhouse API pública, AlterLab (JS rendering)
- Rodam como processo contínuo (servidor ou container)

### Banco de Dados
- **Supabase (PostgreSQL)**
- Row Level Security (RLS) habilitado
- Tabelas principais: `scraped_jobs`, `profiles`, mais schema completo para expansão futura

### Serviços Externos
- **AlterLab API** (`api.alterlab.io`) — scraping com JS rendering para SPAs
- **Google Favicon API** (`google.com/s2/favicons`) — logos das empresas
- **Stripe** — pagamentos (não integrado ainda)
- **OpenAI** — adaptação de currículo (não integrado ainda)
- **Resend** — envio de emails de alerta (não integrado ainda)

---

## 4. Estrutura do Repositório

```
ocupa/
├── apps/
│   ├── web/                    # Next.js 14 frontend
│   │   ├── app/
│   │   │   ├── page.tsx        # Dashboard (feed de vagas)
│   │   │   ├── layout.tsx      # Root layout + providers
│   │   │   ├── api/jobs/route.ts   # API endpoint de busca
│   │   │   ├── auth/callback/route.ts  # OAuth callback
│   │   │   ├── get-started/page.tsx    # Onboarding (8 passos)
│   │   │   ├── checkout/page.tsx       # Checkout Stripe (placeholder)
│   │   │   ├── pricing/page.tsx        # Página de planos
│   │   │   └── onboarding/page.tsx     # Placeholder antigo
│   │   ├── components/
│   │   │   ├── AuthModal.tsx           # Modal login (Google OAuth + Magic Link)
│   │   │   ├── AuthModalContext.tsx    # Estado do modal + dismiss 24h
│   │   │   ├── DashNav.tsx             # Navbar (logo, tema, avatar, upgrade)
│   │   │   ├── JobFeed.tsx             # Feed principal + tabs + "carregar mais"
│   │   │   ├── JobRow.tsx              # Card de vaga individual
│   │   │   ├── UpgradeModal.tsx        # Modal de upgrade Pro
│   │   │   ├── UpgradeModalContext.tsx # Estado do modal de upgrade
│   │   │   ├── UserContext.tsx         # Autenticação + isPro do Supabase
│   │   │   ├── Providers.tsx           # Wrapper de contextos
│   │   │   ├── ThemeProvider.tsx       # Dark/light mode
│   │   │   └── FreshBadge.tsx          # Badge "X min atrás"
│   │   ├── lib/
│   │   │   ├── supabase.ts             # Client simples (usado na API route)
│   │   │   ├── supabase-browser.ts     # Singleton browser client (SSR)
│   │   │   ├── utils.ts                # cn(), timeAgo(), getCompanyColor()
│   │   │   └── mock-data.ts            # Tipos Job, WorkModel, Area, etc.
│   │   ├── middleware.ts               # Protege /get-started e /checkout
│   │   └── .env.local                  # Variáveis de ambiente (não commitado)
│   └── scraper/
│       ├── scrapers/
│       │   ├── gupy.py                 # Gupy portal público (companyId)
│       │   ├── greenhouse.py           # Greenhouse API pública (slug)
│       │   └── alterlab.py             # AlterLab para SPAs com JS rendering
│       ├── scheduler.py                # Orquestra scrapers (schedule lib)
│       ├── backfill_descriptions.py    # Preenche descrições faltando
│       ├── debug_alterlab.py           # Debug do AlterLab (não consome prod)
│       ├── requirements.txt
│       └── .env.example
└── supabase/
    └── migrations/
        ├── 001_initial_schema.sql      # Schema completo (users, jobs, etc.)
        ├── 002_scraped_jobs.sql        # Tabela scraped_jobs
        ├── 003_add_description.sql     # Coluna description na scraped_jobs
        ├── 004_profiles.sql            # Tabela profiles (is_pro) + trigger
        └── 005_cleanup_invalid_titles.sql  # Delete vagas com títulos inválidos
```

---

## 5. Banco de Dados

### Tabela `scraped_jobs` (principal)
```sql
id              TEXT PRIMARY KEY  -- ID externo do ATS (ex: "7662752003" do Greenhouse)
title           TEXT
company         TEXT              -- slug (ex: "nubank", "ifood")
location        TEXT
url             TEXT
employment_type TEXT DEFAULT 'presencial'
salary_min      INTEGER
salary_max      INTEGER
posted_at       TIMESTAMPTZ
description     TEXT
source          TEXT              -- 'gupy' | 'greenhouse' | 'alterlab'
tier            TEXT DEFAULT 'free'
created_at      TIMESTAMPTZ DEFAULT NOW()
```

**RLS**: leitura pública, INSERT liberado para o scraper (service role key).

### Tabela `profiles`
```sql
id         UUID PRIMARY KEY REFERENCES auth.users(id)
is_pro     BOOLEAN DEFAULT FALSE
created_at TIMESTAMPTZ DEFAULT NOW()
```

**Trigger**: cria perfil automaticamente ao criar usuário no Supabase Auth.  
**RLS**: usuário lê apenas o próprio perfil.

### Schema completo (migration 001)
Existe um schema expandido com tabelas para: `users`, `user_profiles`, `resumes`, `companies`, `jobs`, `alerts`, `auto_applications`, `application_pipeline`, `roasts`, `scraping_logs`. Ainda não usado ativamente — infraestrutura para fases futuras.

---

## 6. Scrapers

### Frequência
- **Gupy + Greenhouse**: a cada 30 minutos
- **AlterLab**: 1x/dia às 06:00 + ao iniciar o processo

### Gupy (`scrapers/gupy.py`)
- API: `https://employability-portal.gupy.io/api/v1/jobs?companyId={id}&limit=100`
- Requer `companyId` (inteiro) — não usa slug
- Paginação via `offset`

**Empresas configuradas:**
| companyId | Slug |
|-----------|------|
| 119 | ambev |
| 246 | renner |
| 295 | boticario |
| 316 | vivo |
| 487 | dasa |

> Stone, Loggi, Creditas **não estão** no portal público do Gupy — têm boards próprios.

### Greenhouse (`scrapers/greenhouse.py`)
- API: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs`
- Sem autenticação
- Retorna lista de jobs com `id`, `title`, `location.name`, `absolute_url`, `updated_at`, `content`

**Empresas configuradas (17):**
`nubank`, `wildlifestudios`, `cloudwalk`, `neon`, `caju`, `flash`, `alice`, `dock`, `unico`, `ciandt`, `xpinc`, `c6bank`, `picpay`, `quintoandar`, `vtex`, `inter`, `stone`

> Stone movida para cá após confirmar que `boards-api.greenhouse.io/v1/boards/stone/jobs` retorna 459 vagas.

### AlterLab (`scrapers/alterlab.py`)
- API: `https://api.alterlab.io/api/v1/scrape` (POST, `X-API-Key: ALTERLAB_API_KEY`)
- Renderiza JS — necessário para SPAs
- Custo por requisição — use com moderação

**Empresas configuradas (3):**
| slug | URL | Tipo de parser |
|------|-----|----------------|
| ifood | https://carreiras.ifood.com.br | `custom` (text parser regex) |
| creditas | https://creditas.gupy.io | `gupy_board` (JSON `items[]`) |
| hotmart | https://hotmart.com/en/jobs | `custom` (generic JSON walker) |

**Hierarquia de parsers em `_extract_jobs`:**
1. iFood: text parser específico (`_parse_ifood_text`)
2. Typed parser: greenhouse / lever / gupy_board
3. Generic JSON walker (`_parse_generic_json`)
4. Double-encoded JSON fallback
5. Text fallback (`_parse_text_fallback`)

**Limpeza de títulos:**
- `_TITLE_BLACKLIST`: filtra links de navegação (Terms of Use, Privacy Notice, etc.)
- `_CITY_SUFFIX_RE`: remove "São Paulo - SP and Hybrid Full-time employee" de títulos Gupy
- `_IFOOD_PREFIX_RE`: remove cidade colada no início do título (ex: "Osasco, Analista...")

**Empresas removidas/migradas:**
- `stone` → migrada para `greenhouse.py` (459 vagas, API direta)
- `loggi` → removida (sem vagas abertas no momento)
- Empresas que estavam no AlterLab mas têm Greenhouse API: xpinc, c6bank, picpay, quintoandar, vtex, inter

---

## 7. Frontend — Estado Atual

### O que funciona
- **Feed de vagas** completo com filtros server-side (área, senioridade, modelo de trabalho, busca, localização)
- **Paginação** (50 por página, "Carregar mais")
- **"Não tenho interesse"** — oculta vagas com localStorage, tab de vagas escondidas
- **Logos** via Google Favicon API (`s2/favicons?domain=X&sz=64`) com fallback colorido por hash
- **Autenticação Google OAuth** + Magic Link via Supabase Auth (implementado, aguarda configuração no dashboard)
- **Avatar do usuário** — foto do Google ou iniciais
- **Badge Pro** no dropdown do avatar para usuários Pro
- **"Aplicar por mim"** → auth modal (sem login) / upgrade modal (login sem Pro) / abre vaga (Pro)
- **Middleware** protegendo `/get-started` e `/checkout` para usuários não autenticados
- **Dark/light mode** com persistência em localStorage

### O que está incompleto / placeholder
- **Stripe**: `/checkout` é um placeholder sem integração
- **Onboarding real**: `/get-started` tem a UI dos 8 passos mas não salva dados no banco
- **Auto-apply**: não implementado (o botão "Aplicar por mim" para usuários Pro abre a vaga externamente)
- **Alertas por email**: campo `RESEND_API_KEY` no `.env.local` mas sem código de envio
- **OpenAI / currículo adaptado**: campo `OPENAI_API_KEY` no `.env.local` mas sem integração
- **Google OAuth no Supabase**: precisa configurar provider Google no dashboard do Supabase

### Fluxo de autenticação
```
Usuário clica "Continuar com Google"
  → supabase.auth.signInWithOAuth({ provider: 'google' })
  → Redireciona para Google
  → Google redireciona para /auth/callback?code=...
  → route.ts faz exchangeCodeForSession(code)
  → Redireciona para /
  → onAuthStateChange no UserContext dispara
  → Busca is_pro em profiles
  → Atualiza estado global
```

---

## 8. Variáveis de Ambiente

### `apps/web/.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=           # URL do projeto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # Anon key pública (segura no cliente)
SUPABASE_SERVICE_ROLE_KEY=          # Service role (só server-side)
STRIPE_SECRET_KEY=                  # Stripe backend
STRIPE_WEBHOOK_SECRET=              # Validação de webhooks Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY= # Stripe frontend
STRIPE_PRO_PRICE_ID=                # ID do price Pro no Stripe
OPENAI_API_KEY=                     # Para adaptação de currículo (futuro)
RESEND_API_KEY=                     # Para envio de alertas por email (futuro)
```

### `apps/scraper/.env`
```
SUPABASE_URL=          # Mesmo que NEXT_PUBLIC_SUPABASE_URL
SUPABASE_KEY=          # Service role key (scraper precisa inserir)
ALTERLAB_API_KEY=      # sk_live_... (tem custo por uso)
```

---

## 9. Decisões Técnicas Importantes

### Por que AlterLab para algumas empresas?
Algumas empresas (iFood, Creditas, Hotmart) usam SPAs que exigem renderização JavaScript para exibir vagas. O AlterLab renderiza o JS e retorna o conteúdo. Custo: créditos por requisição.

### Por que não usar o Gupy portal para Stone/Loggi/Creditas?
O Gupy portal público (`employability-portal.gupy.io`) só lista empresas que optaram por publicar lá. Stone, Loggi e Creditas têm boards próprios (`slug.gupy.io`) mas não estão no portal público — não têm `companyId` acessível.

### Por que `@supabase/ssr` além de `@supabase/supabase-js`?
O `@supabase/ssr` é necessário para gerenciar sessão via cookies (compatível com Next.js Server Components e middleware). O `supabase-js` simples não persiste sessão entre server e client no App Router.

- `lib/supabase.ts` — client simples usado na API route de jobs (só leitura pública, sem auth)
- `lib/supabase-browser.ts` — singleton com `createBrowserClient` para componentes client

### Por que filtros de área/senioridade no servidor?
Área e senioridade não são colunas na tabela `scraped_jobs` — são inferidas do título via pattern matching. O servidor aplica `.or('title.ilike.%padrão1%,title.ilike.%padrão2%,...')` no Supabase para cada área/senioridade selecionada.

### Por que IDs de vagas não são UUIDs?
Os IDs vêm dos sistemas externos (Greenhouse, Gupy, etc.) para permitir deduplicação: se a mesma vaga for scrapeada duas vezes, o `INSERT` falha por PK conflict e é ignorado.

### Logos via Google Favicon API
Clearbit estava sendo usado antes mas as logos não carregavam. A API do Google (`google.com/s2/favicons?domain=X&sz=64`) é gratuita, sem autenticação e mais confiável.

---

## 10. Próximos Passos (Em Ordem de Prioridade)

### P0 — Necessário para funcionar
1. **Configurar Google OAuth no Supabase dashboard** (Authentication → Providers → Google)
   - Criar projeto no Google Cloud Console
   - Adicionar Client ID + Secret no Supabase
   - Adicionar `https://[projeto].supabase.co/auth/v1/callback` como Redirect URI no Google
2. **Rodar migration 005** no Supabase (limpar títulos inválidos do banco)
3. **Rodar migration 004** se ainda não foi executada (tabela `profiles` + trigger)

### P1 — Core do produto
4. **Stripe**: integrar checkout em `/checkout`, webhook para atualizar `profiles.is_pro = true`
5. **Onboarding real**: salvar dados do `/get-started` no banco (`user_profiles`, `resumes`)
6. **Alertas por email**: Resend + cron que detecta vagas novas e envia para usuários com filtros salvos

### P2 — Diferencial competitivo
7. **Auto-apply engine**: backend que aplica via Playwright/Selenium usando dados do perfil
8. **Adaptação de currículo**: OpenAI para reescrever seções do currículo por vaga
9. **Pipeline de candidaturas**: dashboard com status de cada aplicação

### P3 — Escala e qualidade
10. **Hotmart parser**: rodar `debug_alterlab.py hotmart --full` e ajustar parser se necessário
11. **Adicionar mais empresas**: Mercado Livre, 99, Totvs, B3, Itaú, Bradesco, Ambev Tech
12. **Descrições de vagas**: rodar `backfill_descriptions.py` para preencher descrições faltando
13. **Notificações push**: PWA com service worker (manifest.json já existe)

---

## 11. Empresas Monitoradas por Fonte

### Greenhouse (17 empresas)
Nubank, Wildlife Studios, CloudWalk, Neon, Caju, Flash, Alice, Dock, Unico, CI&T, XP Inc, C6 Bank, PicPay, QuintoAndar, VTEX, Banco Inter, Stone

### Gupy Portal (5 empresas)
Ambev, Renner, Boticário, Vivo, DASA

### AlterLab (3 empresas)
iFood, Creditas, Hotmart

### Total: ~25 empresas ativas

---

## 12. Design System

**Cor primária**: `#2f8d6a` (verde Ocupa)  
**Fonte principal**: Inter  
**Fonte mono**: DM Mono (variável CSS `--font-dm-mono`)  
**Dark mode**: classe `dark` no `<html>`, toggle via `ThemeProvider`

**CSS Variables principais** (definidas no `globals.css`):
```
--d-nav         fundo da navbar
--d-surface     fundo de superfícies elevadas
--d-border      cor de bordas
--d-text        texto principal
--d-text-2      texto secundário
--d-muted       texto desabilitado/auxiliar
--d-accent      #2f8d6a (primária)
--d-accent-subtle  fundo suave da cor primária
--d-accent-text    texto sobre fundo suave
--d-accent-border  borda suave da cor primária
--d-tag-bg      fundo de tags/badges neutras
```

---

## 13. Como Rodar Localmente

### Frontend
```bash
cd apps/web
cp .env.example .env.local   # preencher variáveis
npm install
npm run dev                  # http://localhost:3000
```

### Scrapers
```bash
cd apps/scraper
pip install -r requirements.txt
cp .env.example .env         # preencher variáveis
python scheduler.py          # roda scrapers continuamente
# ou para rodar uma vez:
python -c "from scrapers.greenhouse import scrape_greenhouse; print(scrape_greenhouse())"
```

### Debug AlterLab (gasta créditos)
```bash
cd apps/scraper
python debug_alterlab.py creditas          # preview 800 chars
python debug_alterlab.py hotmart --full    # output completo
```

---

## 14. Issues Conhecidos

| Componente | Issue | Status |
|------------|-------|--------|
| Google OAuth | Precisa configurar no Supabase dashboard | Aguardando config |
| Hotmart parser | Não validado após mudança de URL para `hotmart.com/en/jobs` | Precisa debug |
| Descrições de vagas | Maioria das vagas AlterLab não tem descrição | Backfill disponível |
| Stripe | Checkout é placeholder | Não iniciado |
| Títulos inválidos no banco | Vagas com "Terms of Use", "Privacy Notice" etc. inseridas antes do blacklist | Migration 005 resolve |
| `lib/supabase.ts` | Usa `createClient` simples (ok para jobs API, mas não tem SSR auth) | Separado em `supabase-browser.ts` |
