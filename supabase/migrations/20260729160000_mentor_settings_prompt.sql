-- Prompt do Charlie editável no control room (sem deploy de código).
CREATE TABLE IF NOT EXISTS public.mentor_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.mentor_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.mentor_settings TO service_role;
-- Sem policy para authenticated: só service_role (admin fns)
