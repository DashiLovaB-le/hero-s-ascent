-- =============================================================================
-- Mentor IA ? mensagens, mem?rias e desafios
-- Fonte can?nica do schema do Mentor (edite aqui).
-- Espelho da migration: supabase/migrations/20260717050000_mentor_ai.sql
-- =============================================================================

CREATE TYPE public.mentor_message_role AS ENUM ('user', 'assistant');
CREATE TYPE public.mentor_message_kind AS ENUM (
  'chat',
  'morning',
  'evening',
  'return',
  'challenge',
  'insight',
  'welcome'
);
CREATE TYPE public.mentor_challenge_status AS ENUM (
  'ativo',
  'concluido',
  'expirado',
  'recusado'
);

-- =========== MENTOR MESSAGES ===========
CREATE TABLE public.mentor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.mentor_message_role NOT NULL,
  kind public.mentor_message_kind NOT NULL DEFAULT 'chat',
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mentor_messages_user_created_idx
  ON public.mentor_messages (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.mentor_messages TO authenticated;
GRANT ALL ON public.mentor_messages TO service_role;

ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver pr?prias mensagens do mentor"
  ON public.mentor_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Inserir pr?prias mensagens do mentor"
  ON public.mentor_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- =========== MENTOR MEMORIES ===========
CREATE TABLE public.mentor_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  importance SMALLINT NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mentor_memories_user_created_idx
  ON public.mentor_memories (user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.mentor_memories TO authenticated;
GRANT ALL ON public.mentor_memories TO service_role;

ALTER TABLE public.mentor_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver pr?prias mem?rias do mentor"
  ON public.mentor_memories FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Inserir pr?prias mem?rias do mentor"
  ON public.mentor_memories FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Apagar pr?prias mem?rias do mentor"
  ON public.mentor_memories FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =========== MENTOR CHALLENGES ===========
CREATE TABLE public.mentor_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  duracao_dias INTEGER NOT NULL DEFAULT 1 CHECK (duracao_dias BETWEEN 1 AND 30),
  xp_recompensa INTEGER NOT NULL DEFAULT 100 CHECK (xp_recompensa BETWEEN 10 AND 2000),
  titulo_recompensa TEXT,
  status public.mentor_challenge_status NOT NULL DEFAULT 'ativo',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX mentor_challenges_user_status_idx
  ON public.mentor_challenges (user_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.mentor_challenges TO authenticated;
GRANT ALL ON public.mentor_challenges TO service_role;

ALTER TABLE public.mentor_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver pr?prios desafios do mentor"
  ON public.mentor_challenges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Inserir pr?prios desafios do mentor"
  ON public.mentor_challenges FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Atualizar pr?prios desafios do mentor"
  ON public.mentor_challenges FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
