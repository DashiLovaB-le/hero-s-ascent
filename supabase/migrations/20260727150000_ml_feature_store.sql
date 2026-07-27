-- =============================================================================
-- ML Fase 1 — Feature Store + scores preditivos
-- user_features / user_ml_scores — leitura pelo usuário; escrita via service_role
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_features (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  features_version TEXT NOT NULL DEFAULT 'v1',
  dias_ativos_7 INTEGER NOT NULL DEFAULT 0,
  dias_ativos_21 INTEGER NOT NULL DEFAULT 0,
  dias_sem_habito INTEGER NOT NULL DEFAULT 0,
  media_habitos_dia_7 NUMERIC(8, 3) NOT NULL DEFAULT 0,
  media_habitos_dia_21 NUMERIC(8, 3) NOT NULL DEFAULT 0,
  taxa_conclusao_7 NUMERIC(6, 4) NOT NULL DEFAULT 0,
  taxa_conclusao_21 NUMERIC(6, 4) NOT NULL DEFAULT 0,
  weekday_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
  streak_atual INTEGER NOT NULL DEFAULT 0,
  streak_maximo INTEGER NOT NULL DEFAULT 0,
  xp_total INTEGER NOT NULL DEFAULT 0,
  nivel INTEGER NOT NULL DEFAULT 1,
  desafios_ativos INTEGER NOT NULL DEFAULT 0,
  desafios_concluidos_21 INTEGER NOT NULL DEFAULT 0,
  desafios_expirados_21 INTEGER NOT NULL DEFAULT 0,
  ultimo_dia_completo DATE,
  dias_desde_ultima_atividade INTEGER,
  media_xp_dia_21 NUMERIC(10, 3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_features_computed_at_idx
  ON public.user_features (computed_at DESC);

GRANT SELECT ON public.user_features TO authenticated;
GRANT ALL ON public.user_features TO service_role;

ALTER TABLE public.user_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprias features ML" ON public.user_features;
CREATE POLICY "Ver próprias features ML"
  ON public.user_features FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_features_updated ON public.user_features;
CREATE TRIGGER trg_user_features_updated
  BEFORE UPDATE ON public.user_features
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_ml_scores (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_version TEXT NOT NULL DEFAULT 'heuristic_v1',
  risco_streak NUMERIC(5, 4) NOT NULL DEFAULT 0
    CHECK (risco_streak >= 0 AND risco_streak <= 1),
  risco_abandono NUMERIC(5, 4) NOT NULL DEFAULT 0
    CHECK (risco_abandono >= 0 AND risco_abandono <= 1),
  projecao_dias_proximo_nivel INTEGER,
  weekday_weakest SMALLINT
    CHECK (weekday_weakest IS NULL OR (weekday_weakest >= 0 AND weekday_weakest <= 6)),
  explicacao JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_ml_scores_computed_at_idx
  ON public.user_ml_scores (computed_at DESC);

CREATE INDEX IF NOT EXISTS user_ml_scores_risco_streak_idx
  ON public.user_ml_scores (risco_streak DESC);

GRANT SELECT ON public.user_ml_scores TO authenticated;
GRANT ALL ON public.user_ml_scores TO service_role;

ALTER TABLE public.user_ml_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprios scores ML" ON public.user_ml_scores;
CREATE POLICY "Ver próprios scores ML"
  ON public.user_ml_scores FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_ml_scores_updated ON public.user_ml_scores;
CREATE TRIGGER trg_user_ml_scores_updated
  BEFORE UPDATE ON public.user_ml_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
