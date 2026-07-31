-- Personalidades do Charlie (catálogo editável) + escolha por usuário.

CREATE TABLE IF NOT EXISTS public.mentor_personalities (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.mentor_personalities ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.mentor_personalities TO authenticated;
GRANT ALL ON public.mentor_personalities TO service_role;

DROP POLICY IF EXISTS "Authenticated can read active mentor personalities"
  ON public.mentor_personalities;
CREATE POLICY "Authenticated can read active mentor personalities"
  ON public.mentor_personalities
  FOR SELECT
  TO authenticated
  USING (is_active = true);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS charlie_personality TEXT NOT NULL DEFAULT 'classico';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_charlie_personality_fkey'
  ) THEN
    -- FK só após seed; se ainda vazio, adia via trigger opcional.
    -- Inserimos placeholder mínimo do classico para a FK funcionar.
    INSERT INTO public.mentor_personalities (slug, name, tagline, description, system_prompt, is_active, sort_order)
    VALUES (
      'classico',
      'Charlie Clássico',
      'Equilibrado. Faz perguntas. Incentiva sem pressionar.',
      'Ideal para a maioria dos usuários.',
      'PLACEHOLDER — substituído pelo seed da aplicação.',
      true,
      10
    )
    ON CONFLICT (slug) DO NOTHING;

    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_charlie_personality_fkey
      FOREIGN KEY (charlie_personality)
      REFERENCES public.mentor_personalities(slug)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Se já existia prompt global em mentor_settings, promove para o Clássico.
DO $$
DECLARE
  legacy TEXT;
BEGIN
  SELECT value INTO legacy
  FROM public.mentor_settings
  WHERE key = 'system_prompt'
  LIMIT 1;

  IF legacy IS NOT NULL AND length(trim(legacy)) >= 80 THEN
    UPDATE public.mentor_personalities
    SET
      system_prompt = trim(legacy),
      updated_at = now()
    WHERE slug = 'classico'
      AND (
        system_prompt LIKE 'PLACEHOLDER%'
        OR length(trim(system_prompt)) < 80
      );
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_charlie_personality
  ON public.profiles (charlie_personality);
