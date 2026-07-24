-- =============================================================================
-- Telegram: vínculo + opt-in (notificações)
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  code TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_user
  ON public.telegram_link_codes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_expires
  ON public.telegram_link_codes (expires_at)
  WHERE used_at IS NULL;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.telegram_link_codes TO service_role;
-- authenticated não precisa INSERT direto em link_codes (só via server fn / admin)

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sem acesso direto link codes" ON public.telegram_link_codes;
-- Sem policies para authenticated = bloqueado via RLS (só service_role)

-- Usuário autenticado não pode inventar telegram_chat_id (só limpar / opt-in)
CREATE OR REPLACE FUNCTION public.guard_telegram_profile_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.telegram_chat_id IS DISTINCT FROM OLD.telegram_chat_id THEN
    IF NEW.telegram_chat_id IS NOT NULL THEN
      NEW.telegram_chat_id := OLD.telegram_chat_id;
      NEW.telegram_linked_at := OLD.telegram_linked_at;
    ELSE
      NEW.telegram_opt_in := false;
      NEW.telegram_linked_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_telegram_profile_cols ON public.profiles;
CREATE TRIGGER trg_guard_telegram_profile_cols
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_telegram_profile_cols();
