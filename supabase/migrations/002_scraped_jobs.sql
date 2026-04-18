-- Vagas brutas dos scrapers (Gupy, Greenhouse, etc.)
-- Schema flat — sem FK para companies, para simplificar o scraper
CREATE TABLE scraped_jobs (
    id              TEXT PRIMARY KEY,          -- ID externo do ATS (ex: "123456")
    title           TEXT NOT NULL,
    company         TEXT NOT NULL,             -- slug da empresa (ex: 'ifood', 'nubank')
    location        TEXT,
    url             TEXT,
    employment_type TEXT DEFAULT 'presencial', -- 'remoto' | 'híbrido' | 'presencial'
    salary_min      INTEGER,
    salary_max      INTEGER,
    posted_at       TIMESTAMPTZ,
    source          TEXT NOT NULL,             -- 'gupy' | 'greenhouse'
    tier            TEXT DEFAULT 'free',
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Índices para queries do feed
CREATE INDEX idx_scraped_jobs_posted_at ON scraped_jobs(posted_at DESC);
CREATE INDEX idx_scraped_jobs_company   ON scraped_jobs(company);
CREATE INDEX idx_scraped_jobs_source    ON scraped_jobs(source);

-- RLS: leitura pública (anon key pode ler)
ALTER TABLE scraped_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scraped_jobs_public_read"
    ON scraped_jobs FOR SELECT USING (true);

-- INSERT: permitido para o scraper com a anon key
-- Em produção, troque SUPABASE_KEY pela service_role key
CREATE POLICY "scraped_jobs_insert"
    ON scraped_jobs FOR INSERT WITH CHECK (true);
