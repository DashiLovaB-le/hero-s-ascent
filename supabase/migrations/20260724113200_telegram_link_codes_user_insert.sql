-- =============================================================================
-- Fix: permitir INSERT/SELECT próprios em telegram_link_codes (sem service_role)
-- =============================================================================

GRANT SELECT, INSERT ON public.telegram_link_codes TO authenticated;

DROP POLICY IF EXISTS "Inserir próprios link codes" ON public.telegram_link_codes;
DROP POLICY IF EXISTS "Ver próprios link codes" ON public.telegram_link_codes;

CREATE POLICY "Inserir próprios link codes"
  ON public.telegram_link_codes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Ver próprios link codes"
  ON public.telegram_link_codes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
