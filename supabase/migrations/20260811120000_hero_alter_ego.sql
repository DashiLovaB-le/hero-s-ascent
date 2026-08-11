-- Alter Ego do Herói (identidade ativa — 1 por usuário no MVP)

CREATE TABLE IF NOT EXISTS public.hero_alter_ego (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  codigo TEXT[] NOT NULL DEFAULT '{}'::text[],
  virtudes TEXT[] NOT NULL DEFAULT '{}'::text[],
  inimigo TEXT NOT NULL DEFAULT '',
  resumo TEXT NOT NULL DEFAULT '',
  source_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hero_alter_ego_user_unique UNIQUE (user_id),
  CONSTRAINT hero_alter_ego_nome_len CHECK (char_length(trim(nome)) BETWEEN 2 AND 60),
  CONSTRAINT hero_alter_ego_codigo_len CHECK (cardinality(codigo) BETWEEN 1 AND 8)
);

CREATE INDEX IF NOT EXISTS hero_alter_ego_user_active_idx
  ON public.hero_alter_ego (user_id)
  WHERE active = true;

COMMENT ON TABLE public.hero_alter_ego IS 'Identidade/Alter Ego do herói (≠ personalidade do Charlie)';
COMMENT ON COLUMN public.hero_alter_ego.codigo IS 'Princípios citáveis (3–5 ideais)';
COMMENT ON COLUMN public.hero_alter_ego.source_answers IS 'Respostas do onboarding / regeneração';

ALTER TABLE public.hero_alter_ego ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_alter_ego TO authenticated;
GRANT ALL ON public.hero_alter_ego TO service_role;

DROP POLICY IF EXISTS "Herói lê próprio alter ego" ON public.hero_alter_ego;
CREATE POLICY "Herói lê próprio alter ego"
  ON public.hero_alter_ego FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Herói cria próprio alter ego" ON public.hero_alter_ego;
CREATE POLICY "Herói cria próprio alter ego"
  ON public.hero_alter_ego FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Herói atualiza próprio alter ego" ON public.hero_alter_ego;
CREATE POLICY "Herói atualiza próprio alter ego"
  ON public.hero_alter_ego FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Herói remove próprio alter ego" ON public.hero_alter_ego;
CREATE POLICY "Herói remove próprio alter ego"
  ON public.hero_alter_ego FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
