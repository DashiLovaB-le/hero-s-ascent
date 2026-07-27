-- =============================================================================
-- Reconcile pós-bagunça Lovable — alinha grants/RLS/constraints ao código
-- Projeto: gmzddccyikpxbiozsiue
-- Seguro para reexecução. NÃO apaga dados de hábitos/perfil/telegram.
-- Rodar no SQL Editor do Supabase (ou via CLI com --db-url).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Lixo temporário / schemas inventados pelo agente
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public._types_ping CASCADE;

-- Colunas erradas da 1ª tentativa (no-op se já não existirem)
ALTER TABLE public.mentor_objectives DROP COLUMN IF EXISTS foco;
ALTER TABLE public.mentor_objectives DROP COLUMN IF EXISTS descricao;
ALTER TABLE public.mentor_objectives DROP COLUMN IF EXISTS metadata;

ALTER TABLE public.mentor_memories DROP COLUMN IF EXISTS key;
ALTER TABLE public.mentor_memories DROP COLUMN IF EXISTS value;
ALTER TABLE public.mentor_memories DROP COLUMN IF EXISTS metadata;
ALTER TABLE public.mentor_memories DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.mentor_challenges DROP COLUMN IF EXISTS expires_at;
ALTER TABLE public.mentor_challenges DROP COLUMN IF EXISTS motivo;
ALTER TABLE public.mentor_challenges DROP COLUMN IF EXISTS metadata;
ALTER TABLE public.mentor_challenges DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.notifications DROP COLUMN IF EXISTS mensagem;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS lida;

-- -----------------------------------------------------------------------------
-- 2) Garantir colunas canônicas (ADD IF NOT EXISTS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wallpaper_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ;

ALTER TABLE public.mentor_challenges
  ADD COLUMN IF NOT EXISTS habit_id UUID REFERENCES public.habits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completions_required INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duracao_dias INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS xp_recompensa INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS titulo_recompensa TEXT,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.mentor_objectives
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- titulo NOT NULL: só força se ainda houver linhas sem título (improvável)
UPDATE public.mentor_objectives SET titulo = 'Objetivo do mentor' WHERE titulo IS NULL OR btrim(titulo) = '';
ALTER TABLE public.mentor_objectives ALTER COLUMN titulo SET NOT NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS corpo TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.mentor_memories
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS importance SMALLINT NOT NULL DEFAULT 3;

UPDATE public.mentor_memories SET content = '' WHERE content IS NULL;
ALTER TABLE public.mentor_memories ALTER COLUMN content SET NOT NULL;

-- -----------------------------------------------------------------------------
-- 3) Constraints (drop + recreate)
-- -----------------------------------------------------------------------------
ALTER TABLE public.mentor_challenges
  DROP CONSTRAINT IF EXISTS mentor_challenges_completions_required_check;
ALTER TABLE public.mentor_challenges
  ADD CONSTRAINT mentor_challenges_completions_required_check
  CHECK (completions_required BETWEEN 1 AND 30);

ALTER TABLE public.mentor_challenges
  DROP CONSTRAINT IF EXISTS mentor_challenges_duracao_check;
ALTER TABLE public.mentor_challenges
  ADD CONSTRAINT mentor_challenges_duracao_check
  CHECK (duracao_dias BETWEEN 1 AND 30);

ALTER TABLE public.mentor_challenges
  DROP CONSTRAINT IF EXISTS mentor_challenges_xp_check;
ALTER TABLE public.mentor_challenges
  ADD CONSTRAINT mentor_challenges_xp_check
  CHECK (xp_recompensa BETWEEN 10 AND 2000);

ALTER TABLE public.mentor_memories
  DROP CONSTRAINT IF EXISTS mentor_memories_importance_check;
ALTER TABLE public.mentor_memories
  ADD CONSTRAINT mentor_memories_importance_check
  CHECK (importance BETWEEN 1 AND 5);

ALTER TABLE public.mentor_objectives
  DROP CONSTRAINT IF EXISTS mentor_objectives_source_check;
ALTER TABLE public.mentor_objectives
  ADD CONSTRAINT mentor_objectives_source_check
  CHECK (source IN ('system', 'ai', 'manual'));

CREATE INDEX IF NOT EXISTS mentor_challenges_habit_idx
  ON public.mentor_challenges (habit_id)
  WHERE habit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS mentor_challenges_user_status_idx
  ON public.mentor_challenges (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, lido_em)
  WHERE lido_em IS NULL;

-- -----------------------------------------------------------------------------
-- 4) Grants + RLS canônicos (remove políticas extras do Lovable)
-- -----------------------------------------------------------------------------

-- Remove grants largos deixados pelo Lovable (GRANT ALL) antes de re-conceder
REVOKE ALL ON public.mentor_messages FROM authenticated;
REVOKE ALL ON public.mentor_memories FROM authenticated;
REVOKE ALL ON public.mentor_challenges FROM authenticated;
REVOKE ALL ON public.mentor_objectives FROM authenticated;
REVOKE ALL ON public.notifications FROM authenticated;
REVOKE ALL ON public.telegram_link_codes FROM authenticated;

-- mentor_messages: precisa UPDATE (metadata.question_answered)
GRANT SELECT, INSERT, UPDATE ON public.mentor_messages TO authenticated;
GRANT ALL ON public.mentor_messages TO service_role;
ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver próprias mensagens do mentor" ON public.mentor_messages;
DROP POLICY IF EXISTS "Inserir próprias mensagens do mentor" ON public.mentor_messages;
DROP POLICY IF EXISTS "Atualizar próprias mensagens do mentor" ON public.mentor_messages;
CREATE POLICY "Ver próprias mensagens do mentor"
  ON public.mentor_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Inserir próprias mensagens do mentor"
  ON public.mentor_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Atualizar próprias mensagens do mentor"
  ON public.mentor_messages FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- mentor_memories
GRANT SELECT, INSERT, DELETE ON public.mentor_memories TO authenticated;
GRANT ALL ON public.mentor_memories TO service_role;
ALTER TABLE public.mentor_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver próprias memórias do mentor" ON public.mentor_memories;
DROP POLICY IF EXISTS "Inserir próprias memórias do mentor" ON public.mentor_memories;
DROP POLICY IF EXISTS "Apagar próprias memórias do mentor" ON public.mentor_memories;
DROP POLICY IF EXISTS "Atualizar próprias memórias do mentor" ON public.mentor_memories;
CREATE POLICY "Ver próprias memórias do mentor"
  ON public.mentor_memories FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Inserir próprias memórias do mentor"
  ON public.mentor_memories FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Apagar próprias memórias do mentor"
  ON public.mentor_memories FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- mentor_challenges
GRANT SELECT, INSERT, UPDATE ON public.mentor_challenges TO authenticated;
GRANT ALL ON public.mentor_challenges TO service_role;
ALTER TABLE public.mentor_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver próprios desafios do mentor" ON public.mentor_challenges;
DROP POLICY IF EXISTS "Inserir próprios desafios do mentor" ON public.mentor_challenges;
DROP POLICY IF EXISTS "Atualizar próprios desafios do mentor" ON public.mentor_challenges;
CREATE POLICY "Ver próprios desafios do mentor"
  ON public.mentor_challenges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Inserir próprios desafios do mentor"
  ON public.mentor_challenges FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Atualizar próprios desafios do mentor"
  ON public.mentor_challenges FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- mentor_objectives
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

-- notifications: INSERT só service_role (código usa admin)
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
REVOKE INSERT, DELETE ON public.notifications FROM authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver próprias notificações" ON public.notifications;
DROP POLICY IF EXISTS "Atualizar próprias notificações" ON public.notifications;
DROP POLICY IF EXISTS "Inserir próprias notificações" ON public.notifications;
DROP POLICY IF EXISTS "Apagar próprias notificações" ON public.notifications;
CREATE POLICY "Ver próprias notificações"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Atualizar próprias notificações"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- telegram_link_codes
GRANT SELECT, INSERT ON public.telegram_link_codes TO authenticated;
GRANT ALL ON public.telegram_link_codes TO service_role;
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Inserir próprios link codes" ON public.telegram_link_codes;
DROP POLICY IF EXISTS "Ver próprios link codes" ON public.telegram_link_codes;
DROP POLICY IF EXISTS "Sem acesso direto link codes" ON public.telegram_link_codes;
CREATE POLICY "Inserir próprios link codes"
  ON public.telegram_link_codes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Ver próprios link codes"
  ON public.telegram_link_codes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.profiles IS NULL;
