-- Migration 006: remove vagas fora do escopo do produto (não-tech/dados/produto/etc)
-- NÃO EXECUTAR AUTOMATICAMENTE — rodar manualmente no Supabase SQL Editor após validar.
--
-- Passo 1: rodar o SELECT abaixo para revisar o que será deletado.
-- Passo 2: se parecer correto, substituir SELECT ... por DELETE e rodar novamente.

-- ─── PREVIEW (rodar primeiro) ────────────────────────────────────────────────

SELECT id, title, company, source, created_at
FROM scraped_jobs
WHERE NOT (
    -- Tecnologia
    title ILIKE '%developer%'        OR title ILIKE '%desenvolvedor%'
    OR title ILIKE '%engineer%'      OR title ILIKE '%engenheir%'
    OR title ILIKE '%software%'      OR title ILIKE '%backend%'
    OR title ILIKE '%frontend%'      OR title ILIKE '%fullstack%'
    OR title ILIKE '%full-stack%'    OR title ILIKE '%devops%'
    OR title ILIKE '%sre%'           OR title ILIKE '%qa%'
    OR title ILIKE '%tester%'        OR title ILIKE '%mobile%'
    OR title ILIKE '%ios%'           OR title ILIKE '%android%'
    OR title ILIKE '%tech lead%'     OR title ILIKE '%arquiteto%'
    OR title ILIKE '%architect%'     OR title ILIKE '%programador%'
    OR title ILIKE '%cloud%'         OR title ILIKE '%infrastructure%'
    OR title ILIKE '%infra%'         OR title ILIKE '%cybersecurity%'
    OR title ILIKE '%security%'      OR title ILIKE '%platform%'
    -- Dados
    OR title ILIKE '%data%'          OR title ILIKE '%dados%'
    OR title ILIKE '%analytics%'     OR title ILIKE '%analista de dados%'
    OR title ILIKE '%cientista%'     OR title ILIKE '%scientist%'
    OR title ILIKE '%machine learning%' OR title ILIKE '%ml engineer%'
    OR title ILIKE '%business intelligence%' OR title ILIKE '%data engineer%'
    OR title ILIKE '%data analyst%'  OR title ILIKE '%analytics engineer%'
    OR title ILIKE '%dba%'
    -- Produto
    OR title ILIKE '%product manager%' OR title ILIKE '%gerente de produto%'
    OR title ILIKE '%product owner%'   OR title ILIKE '%product designer%'
    OR title ILIKE '%product ops%'     OR title ILIKE '%produto%'
    -- Growth
    OR title ILIKE '%growth%'
    -- Marketing
    OR title ILIKE '%marketing%'     OR title ILIKE '%mídia%'
    OR title ILIKE '%paid media%'    OR title ILIKE '%seo%'
    OR title ILIKE '%conteúdo%'      OR title ILIKE '%social media%'
    OR title ILIKE '%aquisição%'     OR title ILIKE '%aquisicao%'
    -- Design
    OR title ILIKE '%designer%'      OR title ILIKE '%product design%'
    OR title ILIKE '%visual design%' OR title ILIKE '%design gráfico%'
    OR title ILIKE '%motion%'
    -- Financeiro
    OR title ILIKE '%financ%'        OR title ILIKE '%finance%'
    OR title ILIKE '%fp&a%'          OR title ILIKE '%fpa%'
    OR title ILIKE '%controller%'    OR title ILIKE '%controladoria%'
    OR title ILIKE '%tesouraria%'    OR title ILIKE '%treasury%'
    OR title ILIKE '%contabil%'      OR title ILIKE '%contábil%'
    OR title ILIKE '%accounting%'    OR title ILIKE '%fiscal%'
    OR title ILIKE '%tributar%'
    -- Operações
    OR title ILIKE '%operations%'    OR title ILIKE '%operações%'
    OR title ILIKE '%operacoes%'     OR title ILIKE '%logística%'
    OR title ILIKE '%logistica%'     OR title ILIKE '%supply chain%'
    OR title ILIKE '%business ops%'  OR title ILIKE '%revenue ops%'
    OR title ILIKE '%bizops%'
)
ORDER BY company, title;

-- ─── DELETE (rodar SOMENTE após validar o SELECT acima) ─────────────────────

-- DELETE FROM scraped_jobs
-- WHERE NOT (
--     title ILIKE '%developer%'        OR title ILIKE '%desenvolvedor%'
--     OR title ILIKE '%engineer%'      OR title ILIKE '%engenheir%'
--     OR title ILIKE '%software%'      OR title ILIKE '%backend%'
--     OR title ILIKE '%frontend%'      OR title ILIKE '%fullstack%'
--     OR title ILIKE '%full-stack%'    OR title ILIKE '%devops%'
--     OR title ILIKE '%sre%'           OR title ILIKE '%qa%'
--     OR title ILIKE '%tester%'        OR title ILIKE '%mobile%'
--     OR title ILIKE '%ios%'           OR title ILIKE '%android%'
--     OR title ILIKE '%tech lead%'     OR title ILIKE '%arquiteto%'
--     OR title ILIKE '%architect%'     OR title ILIKE '%programador%'
--     OR title ILIKE '%cloud%'         OR title ILIKE '%infrastructure%'
--     OR title ILIKE '%infra%'         OR title ILIKE '%cybersecurity%'
--     OR title ILIKE '%security%'      OR title ILIKE '%platform%'
--     OR title ILIKE '%data%'          OR title ILIKE '%dados%'
--     OR title ILIKE '%analytics%'     OR title ILIKE '%analista de dados%'
--     OR title ILIKE '%cientista%'     OR title ILIKE '%scientist%'
--     OR title ILIKE '%machine learning%' OR title ILIKE '%ml engineer%'
--     OR title ILIKE '%business intelligence%' OR title ILIKE '%data engineer%'
--     OR title ILIKE '%data analyst%'  OR title ILIKE '%analytics engineer%'
--     OR title ILIKE '%dba%'
--     OR title ILIKE '%product manager%' OR title ILIKE '%gerente de produto%'
--     OR title ILIKE '%product owner%'   OR title ILIKE '%product designer%'
--     OR title ILIKE '%product ops%'     OR title ILIKE '%produto%'
--     OR title ILIKE '%growth%'
--     OR title ILIKE '%marketing%'     OR title ILIKE '%mídia%'
--     OR title ILIKE '%paid media%'    OR title ILIKE '%seo%'
--     OR title ILIKE '%conteúdo%'      OR title ILIKE '%social media%'
--     OR title ILIKE '%aquisição%'     OR title ILIKE '%aquisicao%'
--     OR title ILIKE '%designer%'      OR title ILIKE '%product design%'
--     OR title ILIKE '%visual design%' OR title ILIKE '%design gráfico%'
--     OR title ILIKE '%motion%'
--     OR title ILIKE '%financ%'        OR title ILIKE '%finance%'
--     OR title ILIKE '%fp&a%'          OR title ILIKE '%fpa%'
--     OR title ILIKE '%controller%'    OR title ILIKE '%controladoria%'
--     OR title ILIKE '%tesouraria%'    OR title ILIKE '%treasury%'
--     OR title ILIKE '%contabil%'      OR title ILIKE '%contábil%'
--     OR title ILIKE '%accounting%'    OR title ILIKE '%fiscal%'
--     OR title ILIKE '%tributar%'
--     OR title ILIKE '%operations%'    OR title ILIKE '%operações%'
--     OR title ILIKE '%operacoes%'     OR title ILIKE '%logística%'
--     OR title ILIKE '%logistica%'     OR title ILIKE '%supply chain%'
--     OR title ILIKE '%business ops%'  OR title ILIKE '%revenue ops%'
--     OR title ILIKE '%bizops%'
-- );
