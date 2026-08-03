-- Optional extra channels on affiliate applications

ALTER TABLE public.affiliate_applications
  ADD COLUMN IF NOT EXISTS outros_canais TEXT;

COMMENT ON COLUMN public.affiliate_applications.outros_canais IS
  'Outros canais / links além do canal principal (texto livre).';
