-- P0 segurança: proteger economia de progresso contra writes diretos via PostgREST (JWT user).
-- Escritas legítimas passam a usar service_role nas server functions.

-- =============================================================================
-- 1) Trigger: colunas de progressão em profiles só com service_role
-- =============================================================================
CREATE OR REPLACE FUNCTION public.guard_progression_profile_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Client autenticado não pode alterar economia / onboarding / streak
  NEW.xp_total := OLD.xp_total;
  NEW.streak_atual := OLD.streak_atual;
  NEW.streak_maximo := OLD.streak_maximo;
  NEW.capitulo_atual := OLD.capitulo_atual;
  NEW.onboarding_completo := OLD.onboarding_completo;
  NEW.ultimo_dia_completo := OLD.ultimo_dia_completo;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_progression_profile_cols ON public.profiles;
CREATE TRIGGER trg_guard_progression_profile_cols
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_progression_profile_cols();

-- =============================================================================
-- 2) habit_completions: client só SELECT
-- =============================================================================
DROP POLICY IF EXISTS "Registrar próprias conclusões" ON public.habit_completions;
DROP POLICY IF EXISTS "Desfazer próprias conclusões" ON public.habit_completions;

REVOKE INSERT, UPDATE, DELETE ON public.habit_completions FROM authenticated;
GRANT SELECT ON public.habit_completions TO authenticated;

-- =============================================================================
-- 3) user_achievements: client só SELECT
-- =============================================================================
DROP POLICY IF EXISTS "Registrar próprias conquistas" ON public.user_achievements;

REVOKE INSERT, UPDATE, DELETE ON public.user_achievements FROM authenticated;
GRANT SELECT ON public.user_achievements TO authenticated;

-- =============================================================================
-- 4) attributes: client só SELECT (não maxar stats via REST)
-- =============================================================================
DROP POLICY IF EXISTS "Inserir próprios atributos" ON public.attributes;
DROP POLICY IF EXISTS "Atualizar próprios atributos" ON public.attributes;

REVOKE INSERT, UPDATE, DELETE ON public.attributes FROM authenticated;
GRANT SELECT ON public.attributes TO authenticated;

-- =============================================================================
-- 5) missions: client só SELECT
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.missions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Gerenciar próprias missões" ON public.missions';
    EXECUTE 'DROP POLICY IF EXISTS "Ver próprias missões" ON public.missions';
    EXECUTE $p$
      CREATE POLICY "Ver próprias missões"
        ON public.missions FOR SELECT TO authenticated
        USING (auth.uid() = user_id)
    $p$;
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.missions FROM authenticated';
    EXECUTE 'GRANT SELECT ON public.missions TO authenticated';
  END IF;
END $$;

-- =============================================================================
-- 6) mentor_challenges: client só SELECT (criar/concluir só server)
-- =============================================================================
DROP POLICY IF EXISTS "Inserir próprios desafios do mentor" ON public.mentor_challenges;
DROP POLICY IF EXISTS "Atualizar próprios desafios do mentor" ON public.mentor_challenges;

REVOKE INSERT, UPDATE, DELETE ON public.mentor_challenges FROM authenticated;
GRANT SELECT ON public.mentor_challenges TO authenticated;

-- =============================================================================
-- 7) activity_history: client só SELECT
-- =============================================================================
DROP POLICY IF EXISTS "Inserir próprio histórico" ON public.activity_history;

REVOKE INSERT, UPDATE, DELETE ON public.activity_history FROM authenticated;
GRANT SELECT ON public.activity_history TO authenticated;

-- =============================================================================
-- 8) CHECK xp_recompensa em habits (5–50)
-- =============================================================================
UPDATE public.habits
SET xp_recompensa = LEAST(GREATEST(COALESCE(xp_recompensa, 10), 5), 50)
WHERE xp_recompensa IS NULL OR xp_recompensa < 5 OR xp_recompensa > 50;

ALTER TABLE public.habits
  DROP CONSTRAINT IF EXISTS habits_xp_recompensa_check;

ALTER TABLE public.habits
  ADD CONSTRAINT habits_xp_recompensa_check
  CHECK (xp_recompensa BETWEEN 5 AND 50);
