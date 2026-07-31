-- Configuração global da app (modo manutenção, etc.). Só service_role escreve.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.app_settings TO service_role;
-- Sem policy para authenticated/anon: leitura/escrita só via service_role (server fns)

INSERT INTO public.app_settings (key, value) VALUES
  ('maintenance_mode', 'false'),
  ('maintenance_title', 'Em manutenção'),
  (
    'maintenance_message',
    'Estamos preparando a próxima etapa da jornada. Voltamos em breve — sua progressão está segura.'
  ),
  ('maintenance_eta', '')
ON CONFLICT (key) DO NOTHING;
