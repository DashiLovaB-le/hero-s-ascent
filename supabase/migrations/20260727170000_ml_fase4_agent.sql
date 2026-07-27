-- =============================================================================
-- ML Fase 4 — Check-ins + agent initiatives + CF recommendations
-- =============================================================================

-- Check-ins diários (sono / energia / humor) — sinais reais, sem inventar
CREATE TABLE IF NOT EXISTS public.user_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dia DATE NOT NULL,
  sono_horas NUMERIC(4, 1),
  sono_qualidade SMALLINT CHECK (sono_qualidade IS NULL OR (sono_qualidade BETWEEN 1 AND 5)),
  energia SMALLINT CHECK (energia IS NULL OR (energia BETWEEN 1 AND 5)),
  humor SMALLINT CHECK (humor IS NULL OR (humor BETWEEN 1 AND 5)),
  nota TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, dia)
);

CREATE INDEX IF NOT EXISTS user_checkins_user_dia_idx
  ON public.user_checkins (user_id, dia DESC);

GRANT SELECT, INSERT, UPDATE ON public.user_checkins TO authenticated;
GRANT ALL ON public.user_checkins TO service_role;

ALTER TABLE public.user_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprios checkins" ON public.user_checkins;
CREATE POLICY "Ver próprios checkins"
  ON public.user_checkins FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Inserir próprios checkins" ON public.user_checkins;
CREATE POLICY "Inserir próprios checkins"
  ON public.user_checkins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Atualizar próprios checkins" ON public.user_checkins;
CREATE POLICY "Atualizar próprios checkins"
  ON public.user_checkins FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_checkins_updated ON public.user_checkins;
CREATE TRIGGER trg_user_checkins_updated
  BEFORE UPDATE ON public.user_checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Iniciativas do agente (não criam desafios sozinhas)
CREATE TABLE IF NOT EXISTS public.agent_initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('checkin_nudge', 'streak_protect', 'cf_habit_hint')),
  titulo TEXT NOT NULL,
  corpo TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'dismissed', 'expired')),
  href TEXT NOT NULL DEFAULT '/mentor',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS agent_initiatives_user_status_idx
  ON public.agent_initiatives (user_id, status, created_at DESC);

-- Máx. 1 iniciativa pending por usuário
CREATE UNIQUE INDEX IF NOT EXISTS agent_initiatives_one_pending_idx
  ON public.agent_initiatives (user_id)
  WHERE status = 'pending';

GRANT SELECT, UPDATE ON public.agent_initiatives TO authenticated;
GRANT ALL ON public.agent_initiatives TO service_role;

ALTER TABLE public.agent_initiatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprias iniciativas" ON public.agent_initiatives;
CREATE POLICY "Ver próprias iniciativas"
  ON public.agent_initiatives FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Atualizar próprias iniciativas" ON public.agent_initiatives;
CREATE POLICY "Atualizar próprias iniciativas"
  ON public.agent_initiatives FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Recomendações CF (somente leitura pelo usuário; escrita service_role)
CREATE TABLE IF NOT EXISTS public.user_cf_recommendations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_version TEXT NOT NULL DEFAULT 'cf_weekday_v1',
  peer_count INTEGER NOT NULL DEFAULT 0,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  explicacao JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_cf_recommendations TO authenticated;
GRANT ALL ON public.user_cf_recommendations TO service_role;

ALTER TABLE public.user_cf_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver próprias recs CF" ON public.user_cf_recommendations;
CREATE POLICY "Ver próprias recs CF"
  ON public.user_cf_recommendations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_cf_recommendations_updated ON public.user_cf_recommendations;
CREATE TRIGGER trg_user_cf_recommendations_updated
  BEFORE UPDATE ON public.user_cf_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_tipo_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_tipo_check CHECK (
    tipo IN (
      'mentor_challenge',
      'mentor_challenge_done',
      'mentor_challenge_expired',
      'habit_complete',
      'habit_reminder',
      'streak_risk',
      'mentor_presence',
      'achievement',
      'system',
      'agent_initiative'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_agent_initiative_day
  ON public.notifications (
    user_id,
    tipo,
    ((timezone('utc', created_at))::date)
  )
  WHERE tipo = 'agent_initiative';
