-- Workout Engine (Fase 2): templates + sessões multi-exercício

CREATE TYPE public.workout_session_status AS ENUM (
  'active',
  'completed',
  'cancelled'
);

CREATE TABLE IF NOT EXISTS public.workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medio',
  duration_min INTEGER NOT NULL DEFAULT 10 CHECK (duration_min BETWEEN 1 AND 120),
  region TEXT NOT NULL DEFAULT 'full',
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.workout_templates(id) ON DELETE SET NULL,
  template_slug TEXT NOT NULL,
  status public.workout_session_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  progress JSONB NOT NULL DEFAULT '[]'::jsonb,
  xp_ganho INTEGER NOT NULL DEFAULT 0 CHECK (xp_ganho >= 0),
  consent_version TEXT NOT NULL DEFAULT 'v1',
  client_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workout_sessions_user_started_idx
  ON public.workout_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS workout_sessions_user_status_idx
  ON public.workout_sessions (user_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS workout_sessions_user_ended_idx
  ON public.workout_sessions (user_id, ended_at DESC)
  WHERE status = 'completed';

-- Seeds espelhando src/lib/fitness/workout-templates.ts
INSERT INTO public.workout_templates (
  slug, titulo, descricao, difficulty, duration_min, region, steps, sort_order
) VALUES
(
  'full-body-12',
  'Corpo inteiro · 12 min',
  'Agachamento, flexão, afundo, prancha e elevação de quadril.',
  'medio',
  12,
  'full',
  '[
    {"exerciseSlug":"squat","sets":3,"targetReps":12,"restMs":40000},
    {"exerciseSlug":"pushup","sets":3,"targetReps":8,"restMs":40000},
    {"exerciseSlug":"lunge","sets":2,"targetReps":10,"restMs":35000},
    {"exerciseSlug":"plank","sets":1,"targetHoldSec":30,"restMs":30000},
    {"exerciseSlug":"glute_bridge","sets":3,"targetReps":12,"restMs":0}
  ]'::jsonb,
  10
),
(
  'legs-focus',
  'Pernas',
  'Agachamento, afundo e elevação de quadril.',
  'medio',
  10,
  'legs',
  '[
    {"exerciseSlug":"squat","sets":3,"targetReps":12,"restMs":45000},
    {"exerciseSlug":"lunge","sets":3,"targetReps":10,"restMs":40000},
    {"exerciseSlug":"glute_bridge","sets":3,"targetReps":12,"restMs":0}
  ]'::jsonb,
  20
),
(
  'push-core',
  'Push + core',
  'Flexão, abdominal e prancha.',
  'facil',
  8,
  'push_core',
  '[
    {"exerciseSlug":"pushup","sets":3,"targetReps":8,"restMs":40000},
    {"exerciseSlug":"situp","sets":3,"targetReps":12,"restMs":35000},
    {"exerciseSlug":"plank","sets":2,"targetHoldSec":25,"restMs":30000}
  ]'::jsonb,
  30
)
ON CONFLICT (slug) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descricao = EXCLUDED.descricao,
  difficulty = EXCLUDED.difficulty,
  duration_min = EXCLUDED.duration_min,
  region = EXCLUDED.region,
  steps = EXCLUDED.steps,
  ativo = true,
  sort_order = EXCLUDED.sort_order;

GRANT SELECT ON public.workout_templates TO authenticated, anon;
GRANT ALL ON public.workout_templates TO service_role;

GRANT SELECT ON public.workout_sessions TO authenticated;
GRANT ALL ON public.workout_sessions TO service_role;

ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workout_templates_public_read" ON public.workout_templates;
CREATE POLICY "workout_templates_public_read"
  ON public.workout_templates FOR SELECT TO authenticated
  USING (ativo = true);

DROP POLICY IF EXISTS "workout_sessions_select_own" ON public.workout_sessions;
CREATE POLICY "workout_sessions_select_own"
  ON public.workout_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
