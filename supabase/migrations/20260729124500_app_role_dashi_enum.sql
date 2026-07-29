-- Role privilegiada do control room: adiciona `dashi` ao enum app_role.
-- (Não migrar dados neste arquivo — novo enum label só é usável após o commit.)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'app_role'
      AND e.enumlabel = 'dashi'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'dashi';
  END IF;
END
$$;
