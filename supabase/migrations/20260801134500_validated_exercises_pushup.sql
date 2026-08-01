-- Exercícios validados (MVP: flexão)
-- Tipo de exercício compartilhado (catálogo); sessão por usuário; sem mídia.

CREATE TYPE public.exercise_session_status AS ENUM (
  'active',
  'completed',
  'cancelled',
  'rejected'
);

CREATE TABLE IF NOT EXISTS public.exercise_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  atributo_padrao public.attribute_type NOT NULL DEFAULT 'forca',
  categoria_padrao public.goal_category NOT NULL DEFAULT 'corpo',
  -- XP híbrido: base + (xp_por_rep_valida * reps) * fator_forma, com tetos
  xp_base INTEGER NOT NULL DEFAULT 15 CHECK (xp_base BETWEEN 0 AND 100),
  xp_por_rep_valida INTEGER NOT NULL DEFAULT 2 CHECK (xp_por_rep_valida BETWEEN 0 AND 20),
  xp_sessao_max INTEGER NOT NULL DEFAULT 120 CHECK (xp_sessao_max BETWEEN 10 AND 500),
  sessoes_por_dia_max INTEGER NOT NULL DEFAULT 3 CHECK (sessoes_por_dia_max BETWEEN 1 AND 20),
  ativo BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exercise_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_type_id UUID NOT NULL REFERENCES public.exercise_types(id) ON DELETE RESTRICT,
  habit_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,
  status public.exercise_session_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  consent_version TEXT NOT NULL DEFAULT 'v1',
  client_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  xp_ganho INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exercise_sessions_user_started_idx
  ON public.exercise_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS exercise_sessions_user_status_idx
  ON public.exercise_sessions (user_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS exercise_sessions_habit_started_idx
  ON public.exercise_sessions (habit_id, started_at DESC)
  WHERE habit_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.exercise_session_metrics (
  session_id UUID PRIMARY KEY REFERENCES public.exercise_sessions(id) ON DELETE CASCADE,
  reps_validas INTEGER NOT NULL DEFAULT 0 CHECK (reps_validas >= 0),
  reps_invalidas INTEGER NOT NULL DEFAULT 0 CHECK (reps_invalidas >= 0),
  duracao_ms INTEGER NOT NULL DEFAULT 0 CHECK (duracao_ms >= 0),
  amplitude_media NUMERIC(5, 2) CHECK (amplitude_media IS NULL OR (amplitude_media >= 0 AND amplitude_media <= 100)),
  forma_pct NUMERIC(5, 2) CHECK (forma_pct IS NULL OR (forma_pct >= 0 AND forma_pct <= 100)),
  cadencia_rpm NUMERIC(6, 2) CHECK (cadencia_rpm IS NULL OR cadencia_rpm >= 0),
  fatigue_rep_index INTEGER CHECK (fatigue_rep_index IS NULL OR fatigue_rep_index >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hábito validado: quando exercise_type_id está preenchido, não usa check direto
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS exercise_type_id UUID REFERENCES public.exercise_types(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS habits_user_exercise_type_unique
  ON public.habits (user_id, exercise_type_id)
  WHERE exercise_type_id IS NOT NULL AND ativo = true;

CREATE INDEX IF NOT EXISTS habits_exercise_type_idx
  ON public.habits (exercise_type_id)
  WHERE exercise_type_id IS NOT NULL;

-- Seed: flexão (tipo global, igual para todos)
INSERT INTO public.exercise_types (
  slug, nome, descricao, atributo_padrao, categoria_padrao,
  xp_base, xp_por_rep_valida, xp_sessao_max, sessoes_por_dia_max, sort_order
) VALUES (
  'pushup',
  'Flexão',
  'Sessão validada por câmera (sem gravar vídeo). Contagem e forma estimadas on-device.',
  'forca',
  'corpo',
  15,
  2,
  120,
  3,
  10
)
ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  atributo_padrao = EXCLUDED.atributo_padrao,
  categoria_padrao = EXCLUDED.categoria_padrao,
  xp_base = EXCLUDED.xp_base,
  xp_por_rep_valida = EXCLUDED.xp_por_rep_valida,
  xp_sessao_max = EXCLUDED.xp_sessao_max,
  sessoes_por_dia_max = EXCLUDED.sessoes_por_dia_max,
  ativo = true,
  sort_order = EXCLUDED.sort_order;

-- Grants / RLS
GRANT SELECT ON public.exercise_types TO authenticated, anon;
GRANT ALL ON public.exercise_types TO service_role;

GRANT SELECT ON public.exercise_sessions TO authenticated;
GRANT ALL ON public.exercise_sessions TO service_role;

GRANT SELECT ON public.exercise_session_metrics TO authenticated;
GRANT ALL ON public.exercise_session_metrics TO service_role;

ALTER TABLE public.exercise_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_session_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exercise_types_public_read" ON public.exercise_types;
CREATE POLICY "exercise_types_public_read"
  ON public.exercise_types FOR SELECT TO authenticated
  USING (ativo = true);

DROP POLICY IF EXISTS "exercise_sessions_select_own" ON public.exercise_sessions;
CREATE POLICY "exercise_sessions_select_own"
  ON public.exercise_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "exercise_metrics_select_own" ON public.exercise_session_metrics;
CREATE POLICY "exercise_metrics_select_own"
  ON public.exercise_session_metrics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exercise_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

-- Escrita só via service role (server functions)
REVOKE INSERT, UPDATE, DELETE ON public.exercise_sessions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.exercise_session_metrics FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.exercise_types FROM authenticated;
