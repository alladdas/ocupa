export type WorkModel = 'remoto' | 'híbrido' | 'presencial'
export type Seniority = 'Júnior' | 'Pleno' | 'Sênior' | 'Lead'
export type Area =
  | 'Tecnologia'
  | 'Dados'
  | 'Produto'
  | 'Growth'
  | 'Marketing'
  | 'Design'
  | 'Financeiro'
  | 'Operações'

export interface Job {
  id: string
  title: string
  company: string
  companySlug: string
  logoUrl: string | null
  location: string
  workModel: WorkModel
  seniority: Seniority
  area: Area
  salary: string | null
  detectedAt: Date
  isOnLinkedin: boolean
  applyUrl: string
  description: string
  tags: string[]
}

export const MOCK_JOBS: Job[] = [
  {
    id: '1',
    title: 'Software Engineer II',
    company: 'Nubank',
    companySlug: 'nubank',
    logoUrl: null,
    location: 'São Paulo, SP',
    workModel: 'híbrido',
    seniority: 'Pleno',
    area: 'Tecnologia',
    salary: 'R$ 12k – R$ 18k',
    detectedAt: new Date(Date.now() - 12 * 60 * 1000), // 12 min ago
    isOnLinkedin: false,
    applyUrl: '#',
    description: 'Trabalhe no banco digital mais inovador da América Latina.',
    tags: ['Kotlin', 'Clojure', 'Kafka', 'AWS'],
  },
  {
    id: '2',
    title: 'Product Manager Sênior',
    company: 'iFood',
    companySlug: 'ifood',
    logoUrl: null,
    location: 'Osasco, SP',
    workModel: 'híbrido',
    seniority: 'Sênior',
    area: 'Produto',
    salary: 'R$ 18k – R$ 25k',
    detectedAt: new Date(Date.now() - 34 * 60 * 1000), // 34 min ago
    isOnLinkedin: false,
    applyUrl: '#',
    description: 'Lidere produtos que impactam milhões de brasileiros.',
    tags: ['Product Strategy', 'OKR', 'Growth'],
  },
  {
    id: '3',
    title: 'Data Scientist Pleno',
    company: 'Stone',
    companySlug: 'stone',
    logoUrl: null,
    location: 'Rio de Janeiro, RJ',
    workModel: 'remoto',
    seniority: 'Pleno',
    area: 'Dados',
    salary: 'R$ 10k – R$ 16k',
    detectedAt: new Date(Date.now() - 1.2 * 60 * 60 * 1000),
    isOnLinkedin: true,
    applyUrl: '#',
    description: 'Modelos de ML para o maior adquirente independente do Brasil.',
    tags: ['Python', 'Spark', 'SQL', 'MLflow'],
  },
  {
    id: '4',
    title: 'Growth Analyst',
    company: 'Creditas',
    companySlug: 'creditas',
    logoUrl: null,
    location: 'São Paulo, SP',
    workModel: 'remoto',
    seniority: 'Pleno',
    area: 'Growth',
    salary: 'R$ 7k – R$ 11k',
    detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    isOnLinkedin: false,
    applyUrl: '#',
    description: 'Escale canais de aquisição na maior fintech de crédito.',
    tags: ['SQL', 'Meta Ads', 'CRO', 'Python'],
  },
  {
    id: '5',
    title: 'UX Designer Sênior',
    company: 'QuintoAndar',
    companySlug: 'quintoandar',
    logoUrl: null,
    location: 'São Paulo, SP',
    workModel: 'híbrido',
    seniority: 'Sênior',
    area: 'Design',
    salary: 'R$ 12k – R$ 18k',
    detectedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    isOnLinkedin: false,
    applyUrl: '#',
    description: 'Redesenhe a experiência de morar bem no Brasil.',
    tags: ['Figma', 'Research', 'Design System', 'Prototyping'],
  },
  {
    id: '6',
    title: 'Backend Engineer (Go)',
    company: 'PicPay',
    companySlug: 'picpay',
    logoUrl: null,
    location: 'São Paulo, SP',
    workModel: 'remoto',
    seniority: 'Sênior',
    area: 'Tecnologia',
    salary: 'R$ 16k – R$ 24k',
    detectedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    isOnLinkedin: true,
    applyUrl: '#',
    description: 'Construa o futuro do super app financeiro brasileiro.',
    tags: ['Go', 'Kubernetes', 'gRPC', 'GCP'],
  },
  {
    id: '7',
    title: 'Analista de Marketing Digital',
    company: 'Hotmart',
    companySlug: 'hotmart',
    logoUrl: null,
    location: 'Belo Horizonte, MG',
    workModel: 'remoto',
    seniority: 'Pleno',
    area: 'Marketing',
    salary: 'R$ 6k – R$ 9k',
    detectedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    isOnLinkedin: false,
    applyUrl: '#',
    description: 'Impulsione a maior plataforma de produtos digitais da América Latina.',
    tags: ['Google Ads', 'Meta Ads', 'Email Marketing', 'Analytics'],
  },
  {
    id: '8',
    title: 'Tech Lead Frontend',
    company: 'VTEX',
    companySlug: 'vtex',
    logoUrl: null,
    location: 'São Paulo, SP',
    workModel: 'híbrido',
    seniority: 'Lead',
    area: 'Tecnologia',
    salary: 'R$ 22k – R$ 30k',
    detectedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    isOnLinkedin: true,
    applyUrl: '#',
    description: 'Lidere o desenvolvimento do maior commerce cloud da América Latina.',
    tags: ['React', 'TypeScript', 'GraphQL', 'Node.js'],
  },
  {
    id: '9',
    title: 'Analista de Dados Júnior',
    company: 'C6 Bank',
    companySlug: 'c6bank',
    logoUrl: null,
    location: 'São Paulo, SP',
    workModel: 'híbrido',
    seniority: 'Júnior',
    area: 'Dados',
    salary: 'R$ 4k – R$ 7k',
    detectedAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
    isOnLinkedin: false,
    applyUrl: '#',
    description: 'Extraia insights para o banco completo do Brasil.',
    tags: ['SQL', 'Python', 'Power BI', 'Excel'],
  },
  {
    id: '10',
    title: 'DevOps Engineer',
    company: 'XP Inc',
    companySlug: 'xpinc',
    logoUrl: null,
    location: 'São Paulo, SP',
    workModel: 'remoto',
    seniority: 'Pleno',
    area: 'Tecnologia',
    salary: 'R$ 14k – R$ 20k',
    detectedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
    isOnLinkedin: false,
    applyUrl: '#',
    description: 'Escale a infraestrutura da maior plataforma de investimentos.',
    tags: ['AWS', 'Terraform', 'Docker', 'CI/CD'],
  },
  {
    id: '11',
    title: 'Product Designer',
    company: 'Loft',
    companySlug: 'loft',
    logoUrl: null,
    location: 'São Paulo, SP',
    workModel: 'remoto',
    seniority: 'Pleno',
    area: 'Design',
    salary: 'R$ 9k – R$ 14k',
    detectedAt: new Date(Date.now() - 9 * 60 * 60 * 1000),
    isOnLinkedin: true,
    applyUrl: '#',
    description: 'Redesenhe o mercado imobiliário brasileiro.',
    tags: ['Figma', 'Motion', 'Usability', 'Design System'],
  },
  {
    id: '12',
    title: 'Engenheiro de Software Júnior',
    company: 'Inter',
    companySlug: 'inter',
    logoUrl: null,
    location: 'Belo Horizonte, MG',
    workModel: 'híbrido',
    seniority: 'Júnior',
    area: 'Tecnologia',
    salary: 'R$ 5k – R$ 8k',
    detectedAt: new Date(Date.now() - 10 * 60 * 60 * 1000),
    isOnLinkedin: false,
    applyUrl: '#',
    description: 'Desenvolva o super app do banco digital completo.',
    tags: ['Java', 'Spring Boot', 'Angular', 'PostgreSQL'],
  },
]

export const AREAS: Area[] = [
  'Tecnologia',
  'Dados',
  'Produto',
  'Growth',
  'Marketing',
  'Design',
  'Financeiro',
  'Operações',
]

export const SENIORITIES: Seniority[] = ['Júnior', 'Pleno', 'Sênior', 'Lead']

export const WORK_MODELS: WorkModel[] = ['remoto', 'híbrido', 'presencial']

export const LOCATIONS = [
  'São Paulo, SP',
  'Rio de Janeiro, RJ',
  'Belo Horizonte, MG',
  'Curitiba, PR',
  'Porto Alegre, RS',
  'Remoto',
]

export const COMPANIES = [
  'Nubank',
  'iFood',
  'Stone',
  'XP Inc',
  'BTG Pactual',
  'C6 Bank',
  'PicPay',
  'Itaú',
  'Bradesco',
  'Inter',
  'Creditas',
  'Loft',
  'QuintoAndar',
  'VTEX',
  'Hotmart',
  'RD Station',
  'Gympass',
  'Loggi',
]
