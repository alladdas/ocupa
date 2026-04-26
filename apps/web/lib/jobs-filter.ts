export const ALLOWED_AREAS_KEYWORDS: string[] = [
  // Tecnologia
  'developer', 'desenvolvedor', 'engineer', 'engenheir', 'software',
  'backend', 'frontend', 'fullstack', 'full-stack', 'devops', 'sre',
  'qa', 'tester', 'mobile', 'ios', 'android', 'tech lead',
  'arquiteto', 'architect', 'programador', 'cloud', 'infrastructure',
  'infra', 'cybersecurity', 'security', 'platform',
  // Dados
  'data', 'dados', 'analytics', 'analista de dados', 'cientista',
  'scientist', 'machine learning', 'ml engineer', 'business intelligence',
  'data engineer', 'data analyst', 'analytics engineer', 'dba',
  // Produto
  'product manager', 'gerente de produto', 'product owner',
  'product designer', 'product ops', 'produto',
  // Growth
  'growth',
  // Marketing
  'marketing', 'mídia', 'paid media', 'seo', 'conteúdo',
  'social media', 'aquisição', 'aquisicao',
  // Design
  'designer', 'product design', 'visual design', 'design gráfico', 'motion',
  // Financeiro
  'financ', 'finance', 'fp&a', 'fpa', 'controller', 'controladoria',
  'tesouraria', 'treasury', 'contabil', 'contábil', 'accounting',
  'fiscal', 'tributar',
  // Operações
  'operations', 'operações', 'operacoes', 'logística', 'logistica',
  'supply chain', 'business ops', 'revenue ops', 'bizops',
]

export const MANDATORY_CLAUSE = ALLOWED_AREAS_KEYWORDS
  .map((k) => `title.ilike.%${k}%`)
  .join(',')
