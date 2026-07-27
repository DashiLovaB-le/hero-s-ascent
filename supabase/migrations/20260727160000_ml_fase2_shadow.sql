-- =============================================================================
-- ML Fase 2 — Shadow scores + model runs
-- Não altera user_ml_scores (Charlie / heuristic_v1).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_ml_scores_shadow (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_version TEXT NOT NULL DEFAULT 'sklearn_v1',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  risco_streak NUMERIC(5, 4) NOT NULL DEFAULT 0
    CHECK (risco_streak >= 0 AND risco_streak <= 1),
  risco_abandono NUMERIC(5, 4) NOT NULL DEFAULT 0
    CHECK (risco_abandono >= 0 AND risco_abandono <= 1),
  explicacao JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, model_version)
);

CREATE INDEX IF NOT EXISTS user_ml_scores_shadow_computed_at_idx
  ON public.user_ml_scores_shadow (computed_at DESC);

GRANT SELECT ON public.user_ml_scores_shadow TO authenticated;
GRANT ALL ON public.user_ml_scores_shadow TO service_role;

ALTER TABLE public.user_ml_scores_shadow ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprios scores ML shadow" ON public.user_ml_scores_shadow;
CREATE POLICY "Ver próprios scores ML shadow"
  ON public.user_ml_scores_shadow FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_ml_scores_shadow_updated ON public.user_ml_scores_shadow;
CREATE TRIGGER trg_user_ml_scores_shadow_updated
  BEFORE UPDATE ON public.user_ml_scores_shadow
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ml_model_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version TEXT NOT NULL DEFAULT 'sklearn_v1',
  trained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auc_streak NUMERIC(6, 4),
  auc_abandono NUMERIC(6, 4),
  n_train INTEGER NOT NULL DEFAULT 0,
  n_test INTEGER NOT NULL DEFAULT 0,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  artifact_path TEXT,
  promoted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ml_model_runs_trained_at_idx
  ON public.ml_model_runs (trained_at DESC);

-- Runs são metadados internos: sem SELECT para authenticated
GRANT ALL ON public.ml_model_runs TO service_role;
REVOKE ALL ON public.ml_model_runs FROM authenticated;
REVOKE ALL ON public.ml_model_runs FROM anon;

ALTER TABLE public.ml_model_runs ENABLE ROW LEVEL SECURITY;
-- Sem policies para authenticated → só service_role
