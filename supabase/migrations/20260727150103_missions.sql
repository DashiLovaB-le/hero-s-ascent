-- Missões de arco (capítulo) — distintas de hábitos e desafios do Charlie
-- enum mission_kind já existe: principal | secundaria

CREATE TABLE IF NOT EXISTS public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.mission_kind NOT NULL DEFAULT 'principal',
  capitulo INTEGER NOT NULL DEFAULT 1 CHECK (capitulo BETWEEN 1 AND 12),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  xp_recompensa INTEGER NOT NULL DEFAULT 50
    CHECK (xp_recompensa BETWEEN 10 AND 2000),
  status TEXT NOT NULL DEFAULT 'ativa'
    CHECK (status IN ('ativa', 'concluida', 'abandonada')),
  progresso_atual INTEGER NOT NULL DEFAULT 0
    CHECK (progresso_atual >= 0),
  progresso_alvo INTEGER NOT NULL DEFAULT 1
    CHECK (progresso_alvo >= 1),
  habit_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,
  track TEXT NOT NULL DEFAULT 'habit_completions',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS missions_user_status_idx
  ON public.missions (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS missions_user_capitulo_idx
  ON public.missions (user_id, capitulo);

-- No máximo 1 missão principal ativa por usuário
CREATE UNIQUE INDEX IF NOT EXISTS missions_one_principal_ativa
  ON public.missions (user_id)
  WHERE kind = 'principal' AND status = 'ativa';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.missions TO authenticated;
GRANT ALL ON public.missions TO service_role;

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gerenciar próprias missões" ON public.missions;
CREATE POLICY "Gerenciar próprias missões"
  ON public.missions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
