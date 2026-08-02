-- Goals enrichment: status, motivo, prazo, norte + vínculo hábito→meta

DO $$ BEGIN
  CREATE TYPE public.goal_status AS ENUM ('ativa', 'pausada', 'concluida');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS status public.goal_status NOT NULL DEFAULT 'ativa',
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS prazo DATE,
  ADD COLUMN IF NOT EXISTS is_norte BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS xp_recompensa INTEGER NOT NULL DEFAULT 40;

-- Backfill status a partir de ativo
UPDATE public.goals
SET status = CASE WHEN ativo THEN 'ativa'::public.goal_status ELSE 'concluida'::public.goal_status END
WHERE status IS NULL OR (ativo = false AND status = 'ativa');

CREATE INDEX IF NOT EXISTS goals_user_status_idx
  ON public.goals (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS goals_user_norte_idx
  ON public.goals (user_id, is_norte)
  WHERE is_norte = true;

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS habits_goal_id_idx
  ON public.habits (goal_id)
  WHERE goal_id IS NOT NULL;

COMMENT ON COLUMN public.goals.motivo IS 'Por quê esta meta importa (texto curto)';
COMMENT ON COLUMN public.goals.is_norte IS 'Meta destaque (máx. 3 ativas por herói)';
COMMENT ON COLUMN public.habits.goal_id IS 'Hábito que sustenta uma meta';
