-- =============================================================================
-- ROLLBACK — Charlie Fase 1
-- Reverte: supabase/migrations/20260717130206_charlie_fase1.sql
-- Rodar manualmente no SQL Editor se quiser desfazer.
--
-- ATENÇÃO: apaga a tabela mentor_objectives e todos os objetivos salvos.
-- Remove habit_id / completions_required de mentor_challenges (dados de vínculo
-- a hábitos nesses desafios são perdidos).
-- O código da app (MentorPage / functions) ainda espera esses objetos —
-- só rode o rollback se for também reverter o código ou aceitar erros no mentor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- DESAFIOS: remover vínculo a hábito
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.mentor_challenges_habit_idx;

ALTER TABLE public.mentor_challenges
  DROP CONSTRAINT IF EXISTS mentor_challenges_completions_required_check;

ALTER TABLE public.mentor_challenges
  DROP COLUMN IF EXISTS habit_id,
  DROP COLUMN IF EXISTS completions_required;

-- -----------------------------------------------------------------------------
-- OBJETIVO DO MENTOR: remover tabela
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_mentor_objectives_updated ON public.mentor_objectives;

DROP POLICY IF EXISTS "Ver próprio objetivo do mentor" ON public.mentor_objectives;
DROP POLICY IF EXISTS "Inserir próprio objetivo do mentor" ON public.mentor_objectives;
DROP POLICY IF EXISTS "Atualizar próprio objetivo do mentor" ON public.mentor_objectives;

DROP TABLE IF EXISTS public.mentor_objectives;
