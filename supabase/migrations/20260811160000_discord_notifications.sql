-- =============================================================================
-- Discord: vínculo + opt-in (notificações DM) — espelho do Telegram
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discord_user_id TEXT,
  ADD COLUMN IF NOT EXISTS discord_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discord_linked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.discord_link_codes (
  code TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discord_link_codes_user
  ON public.discord_link_codes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_discord_link_codes_expires
  ON public.discord_link_codes (expires_at)
  WHERE used_at IS NULL;

GRANT ALL ON public.discord_link_codes TO service_role;
GRANT SELECT, INSERT ON public.discord_link_codes TO authenticated;

ALTER TABLE public.discord_link_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inserir próprios discord link codes" ON public.discord_link_codes;
DROP POLICY IF EXISTS "Ver próprios discord link codes" ON public.discord_link_codes;

CREATE POLICY "Inserir próprios discord link codes"
  ON public.discord_link_codes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Ver próprios discord link codes"
  ON public.discord_link_codes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Usuário autenticado não inventa discord_user_id (só limpar / opt-in)
CREATE OR REPLACE FUNCTION public.guard_discord_profile_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.discord_user_id IS DISTINCT FROM OLD.discord_user_id THEN
    IF NEW.discord_user_id IS NOT NULL THEN
      NEW.discord_user_id := OLD.discord_user_id;
      NEW.discord_linked_at := OLD.discord_linked_at;
    ELSE
      NEW.discord_opt_in := false;
      NEW.discord_linked_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_discord_profile_cols ON public.profiles;
CREATE TRIGGER trg_guard_discord_profile_cols
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_discord_profile_cols();

COMMENT ON COLUMN public.profiles.discord_user_id IS
  'Discord snowflake do usuário (DM). Escrito só pelo webhook/service role.';
