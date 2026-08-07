-- Optional in-body CTA link for announcement popups

ALTER TABLE public.app_popups
  ADD COLUMN IF NOT EXISTS body_link_ativo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS body_link_label TEXT,
  ADD COLUMN IF NOT EXISTS body_link_url TEXT;

ALTER TABLE public.app_popups
  DROP CONSTRAINT IF EXISTS app_popups_body_link_label_len,
  DROP CONSTRAINT IF EXISTS app_popups_body_link_url_len;

ALTER TABLE public.app_popups
  ADD CONSTRAINT app_popups_body_link_label_len
    CHECK (body_link_label IS NULL OR char_length(trim(body_link_label)) BETWEEN 1 AND 60),
  ADD CONSTRAINT app_popups_body_link_url_len
    CHECK (body_link_url IS NULL OR char_length(trim(body_link_url)) BETWEEN 1 AND 800);

COMMENT ON COLUMN public.app_popups.body_link_ativo IS
  'Quando true e label+url preenchidos, mostra botão de link no corpo do pop-up.';
COMMENT ON COLUMN public.app_popups.body_link_label IS
  'Texto do botão de link no corpo do pop-up.';
COMMENT ON COLUMN public.app_popups.body_link_url IS
  'URL do botão de link no corpo (abre em nova aba).';
