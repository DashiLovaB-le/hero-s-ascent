-- Temporary in-app announcement popups (control room)

CREATE TABLE IF NOT EXISTS public.app_popups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  corpo TEXT NOT NULL,
  image_url TEXT,
  button_label TEXT NOT NULL DEFAULT 'Entendi',
  target_path TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_popups_titulo_len CHECK (char_length(trim(titulo)) BETWEEN 1 AND 120),
  CONSTRAINT app_popups_subtitulo_len CHECK (subtitulo IS NULL OR char_length(trim(subtitulo)) <= 200),
  CONSTRAINT app_popups_corpo_len CHECK (char_length(trim(corpo)) BETWEEN 1 AND 4000),
  CONSTRAINT app_popups_button_len CHECK (char_length(trim(button_label)) BETWEEN 1 AND 40),
  CONSTRAINT app_popups_target_len CHECK (char_length(trim(target_path)) BETWEEN 1 AND 120),
  CONSTRAINT app_popups_expires_after_start CHECK (expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS app_popups_active_path_idx
  ON public.app_popups (target_path, ativo, expires_at DESC)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS app_popups_created_idx
  ON public.app_popups (created_at DESC);

ALTER TABLE public.app_popups ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read currently valid popups (app display).
DROP POLICY IF EXISTS app_popups_select_active ON public.app_popups;
CREATE POLICY app_popups_select_active
  ON public.app_popups
  FOR SELECT
  TO authenticated
  USING (
    ativo = true
    AND starts_at <= now()
    AND expires_at > now()
  );

COMMENT ON TABLE public.app_popups IS
  'Pop-ups temporários de anúncio (control room). Separados das notificações.';

-- Public storage for popup images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'popup-images',
  'popup-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS popup_images_public_read ON storage.objects;
CREATE POLICY popup_images_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'popup-images');
