-- Usuários
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    google_id TEXT,
    avatar_url TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
    subscription_status TEXT DEFAULT 'inactive',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Perfil de busca (filtros do usuário)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    areas TEXT[] DEFAULT '{}',
    seniority TEXT[] DEFAULT '{}',
    locations TEXT[] DEFAULT '{}',
    favorite_companies TEXT[] DEFAULT '{}',
    min_salary INTEGER,
    notifications_email BOOLEAN DEFAULT true,
    notifications_push BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Currículos
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT,
    structured_data JSONB,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Empresas monitoradas
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    ats_type TEXT NOT NULL,
    ats_url TEXT NOT NULL,
    tier INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT true,
    last_scraped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Vagas detectadas
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT,
    company_id UUID REFERENCES companies(id),
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    work_model TEXT,
    seniority TEXT,
    area TEXT,
    salary_range TEXT,
    requirements JSONB,
    apply_url TEXT NOT NULL,
    detected_at TIMESTAMPTZ DEFAULT now(),
    is_on_linkedin BOOLEAN DEFAULT false,
    is_ghost BOOLEAN DEFAULT false,
    times_reposted INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    hash TEXT UNIQUE,
    raw_data JSONB
);

-- Alertas enviados
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    job_id UUID REFERENCES jobs(id),
    match_score INTEGER,
    channel TEXT,
    sent_at TIMESTAMPTZ DEFAULT now(),
    clicked BOOLEAN DEFAULT false
);

-- Aplicações automáticas (Pro)
CREATE TABLE auto_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    job_id UUID REFERENCES jobs(id),
    resume_id UUID REFERENCES resumes(id),
    adapted_resume_url TEXT,
    status TEXT DEFAULT 'pending',
    failure_reason TEXT,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Pipeline de candidaturas
CREATE TABLE application_pipeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    job_id UUID REFERENCES jobs(id),
    stage TEXT DEFAULT 'applied',
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Currículo Roast
CREATE TABLE roasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    resume_url TEXT,
    score INTEGER,
    critiques JSONB,
    matching_companies JSONB,
    share_url TEXT UNIQUE,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Scraping logs
CREATE TABLE scraping_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    status TEXT,
    jobs_found INTEGER DEFAULT 0,
    new_jobs INTEGER DEFAULT 0,
    duration_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_jobs_detected_at ON jobs(detected_at DESC);
CREATE INDEX idx_jobs_area ON jobs(area);
CREATE INDEX idx_jobs_seniority ON jobs(seniority);
CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_active ON jobs(is_active);
CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_auto_apps_user ON auto_applications(user_id);

-- RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE roasts ENABLE ROW LEVEL SECURITY;

-- Policies: usuários só veem seus próprios dados
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own profile" ON user_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own resumes" ON resumes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own alerts" ON alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own applications" ON auto_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own pipeline" ON application_pipeline FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own roasts" ON roasts FOR ALL USING (auth.uid() = user_id);

-- Jobs são públicos (leitura)
CREATE POLICY "Jobs are public" ON jobs FOR SELECT USING (true);
CREATE POLICY "Companies are public" ON companies FOR SELECT USING (true);
