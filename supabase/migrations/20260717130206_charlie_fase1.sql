-- =============================================================================
-- Charlie Fase 1 — objetivos, perguntas (via metadata), desafios verificáveis
-- Rodar manualmente no SQL Editor do projeto Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- OBJETIVO ATUAL DO MENTOR (1 ativo por usuário)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mentor_objectives (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  motivo TEXT,
  source TEXT NOT NULL DEFAULT 'system',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mentor_objectives_source_check CHECK (source IN ('system', 'ai', 'manual'))
);

GRANT SELECT, INSERT, UPDATE ON public.mentor_objectives TO authenticated;
GRANT ALL ON public.mentor_objectives TO service_role;

ALTER TABLE public.mentor_objectives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprio objetivo do mentor" ON public.mentor_objectives;
DROP POLICY IF EXISTS "Inserir próprio objetivo do mentor" ON public.mentor_objectives;
DROP POLICY IF EXISTS "Atualizar próprio objetivo do mentor" ON public.mentor_objectives;

CREATE POLICY "Ver próprio objetivo do mentor"
  ON public.mentor_objectives FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Inserir próprio objetivo do mentor"
  ON public.mentor_objectives FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Atualizar próprio objetivo do mentor"
  ON public.mentor_objectives FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_mentor_objectives_updated ON public.mentor_objectives;
CREATE TRIGGER trg_mentor_objectives_updated
  BEFORE UPDATE ON public.mentor_objectives
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- DESAFIOS: vínculo opcional a 1 hábito + meta de conclusões
-- -----------------------------------------------------------------------------
ALTER TABLE public.mentor_challenges
  ADD COLUMN IF NOT EXISTS habit_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completions_required INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.mentor_challenges
  DROP CONSTRAINT IF EXISTS mentor_challenges_completions_required_check;

ALTER TABLE public.mentor_challenges
  ADD CONSTRAINT mentor_challenges_completions_required_check
  CHECK (completions_required BETWEEN 1 AND 30);

CREATE INDEX IF NOT EXISTS mentor_challenges_habit_idx
  ON public.mentor_challenges (habit_id)
  WHERE habit_id IS NOT NULL;
