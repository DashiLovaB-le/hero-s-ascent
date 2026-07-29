-- =============================================================================
-- Control room: níveis (já existe), catálogo de wallpapers, uso de tokens IA
-- =============================================================================

-- levels: garantir grants (já seedado na complete_schema)
GRANT SELECT ON public.levels TO authenticated, anon;
GRANT ALL ON public.levels TO service_role;

-- -----------------------------------------------------------------------------
-- WALLPAPER CATALOG
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallpaper_catalog (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  file_name TEXT,
  image_url TEXT,
  unlock_kind TEXT NOT NULL DEFAULT 'always'
    CHECK (unlock_kind IN ('always', 'level', 'streak_max', 'chapter', 'xp')),
  unlock_min INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallpaper_catalog_ativo_sort
  ON public.wallpaper_catalog (ativo, sort_order);

ALTER TABLE public.wallpaper_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos veem wallpapers ativos" ON public.wallpaper_catalog;
CREATE POLICY "Todos veem wallpapers ativos"
  ON public.wallpaper_catalog FOR SELECT TO anon, authenticated
  USING (ativo = true);

GRANT SELECT ON public.wallpaper_catalog TO anon, authenticated;
GRANT ALL ON public.wallpaper_catalog TO service_role;

-- Seed a partir do catálogo estático (idempotente)
INSERT INTO public.wallpaper_catalog
  (id, titulo, descricao, file_name, unlock_kind, unlock_min, sort_order, ativo)
VALUES
  ('none', 'Escuridão Original', 'O fundo padrão do V-Project.', NULL, 'always', 0, 0, true),
  ('chamado', 'O Chamado', 'Desbloqueado ao iniciar a jornada.', '01-chamado.jpg', 'always', 0, 10, true),
  ('aprendiz', 'Aprendiz', 'Alcance o nível 2 — Aprendiz.', '02-aprendiz.jpg', 'level', 2, 20, true),
  ('iniciado', 'Iniciado', 'Alcance o nível 3 — Iniciado.', '03-iniciado.jpg', 'level', 3, 30, true),
  ('aspirante', 'Aspirante', 'Alcance o nível 4 — Aspirante.', '04-aspirante.jpg', 'level', 4, 40, true),
  ('guerreiro', 'Guerreiro', 'Alcance o nível 5 — Guerreiro.', '05-guerreiro.jpg', 'level', 5, 50, true),
  ('sentinela', 'Sentinela', 'Alcance o nível 6 — Sentinela.', '06-sentinela.jpg', 'level', 6, 60, true),
  ('cavaleiro', 'Cavaleiro', 'Alcance o nível 7 — Cavaleiro.', '07-cavaleiro.jpg', 'level', 7, 70, true),
  ('estrategista', 'Estrategista', 'Alcance o nível 8 — Estrategista.', '08-estrategista.jpg', 'level', 8, 80, true),
  ('mestre', 'Mestre', 'Alcance o nível 9 — Mestre.', '09-mestre.jpg', 'level', 9, 90, true),
  ('sabio', 'Sábio', 'Alcance o nível 10 — Sábio.', '10-sabio.jpg', 'level', 10, 100, true),
  ('rei', 'Rei', 'Alcance o nível 11 — Rei.', '11-rei.jpg', 'level', 11, 110, true),
  ('lenda', 'Lenda', 'Alcance o nível 12 — Lenda.', '12-lenda.jpg', 'level', 12, 120, true),
  ('fogo-7', 'Chama de 7 Dias', 'Mantenha streak máximo de 7 dias.', '13-fogo-7.jpg', 'streak_max', 7, 130, true),
  ('fogo-30', 'Chama de 30 Dias', 'Mantenha streak máximo de 30 dias.', '14-fogo.jpg', 'streak_max', 30, 140, true),
  ('provas', 'As Provas', 'Chegue ao capítulo 3 ou superior.', '15-provas.jpg', 'chapter', 3, 150, true),
  ('abismo', 'O Abismo', 'Chegue ao capítulo 5 ou superior.', '16-abismo.jpg', 'chapter', 5, 160, true)
ON CONFLICT (id) DO NOTHING;

-- Storage bucket público para uploads do control room
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wallpapers',
  'wallpapers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Wallpapers públicos leitura" ON storage.objects;
CREATE POLICY "Wallpapers públicos leitura"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'wallpapers');

DROP POLICY IF EXISTS "Wallpapers service write" ON storage.objects;
CREATE POLICY "Wallpapers service write"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'wallpapers')
  WITH CHECK (bucket_id = 'wallpapers');

-- -----------------------------------------------------------------------------
-- AI USAGE + PRICING
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_cost_rates (
  model TEXT PRIMARY KEY,
  input_usd_per_1m NUMERIC(12, 6) NOT NULL DEFAULT 3,
  output_usd_per_1m NUMERIC(12, 6) NOT NULL DEFAULT 15,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ai_cost_rates (model, input_usd_per_1m, output_usd_per_1m, notes) VALUES
  ('anthropic/claude-sonnet-4', 3.0, 15.0, 'Estimativa OpenRouter — ajuste conforme fatura'),
  ('anthropic/claude-3.5-sonnet', 3.0, 15.0, 'Legacy alias'),
  ('openai/gpt-4o-mini', 0.15, 0.6, 'Estimativa'),
  ('default', 3.0, 15.0, 'Fallback quando o modelo não está na tabela')
ON CONFLICT (model) DO NOTHING;

GRANT SELECT ON public.ai_cost_rates TO authenticated;
GRANT ALL ON public.ai_cost_rates TO service_role;

ALTER TABLE public.ai_cost_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dashi vê rates" ON public.ai_cost_rates;
-- Leitura só via service role / admin fns; authenticated sem policy = bloqueado OK
-- (service_role bypassa RLS)

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'mentor',
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(14, 8) NOT NULL DEFAULT 0,
  finish_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON public.ai_usage_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON public.ai_usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_source ON public.ai_usage_events (source, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ai_usage_events TO service_role;
-- Sem policies para authenticated: só service_role (admin) lê/escreve
