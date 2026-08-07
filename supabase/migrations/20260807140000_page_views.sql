-- Page view analytics for beta / divulgação

CREATE TABLE IF NOT EXISTS public.page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT page_views_path_len CHECK (char_length(trim(path)) BETWEEN 1 AND 240),
  CONSTRAINT page_views_session_len CHECK (char_length(trim(session_id)) BETWEEN 8 AND 80)
);

CREATE INDEX IF NOT EXISTS page_views_created_idx
  ON public.page_views (created_at DESC);

CREATE INDEX IF NOT EXISTS page_views_path_created_idx
  ON public.page_views (path, created_at DESC);

CREATE INDEX IF NOT EXISTS page_views_session_created_idx
  ON public.page_views (session_id, created_at DESC);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- No client policies: inserts via service role only (server fn).

COMMENT ON TABLE public.page_views IS
  'Acessos de página (divulgação / beta). Escrita só via service role.';
