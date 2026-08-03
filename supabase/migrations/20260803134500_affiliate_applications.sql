-- Affiliate partner applications (Kiwify affiliates lead capture).
-- Separate from auth.users / profiles — becoming a hero is optional via /auth.

DO $$ BEGIN
  CREATE TYPE public.affiliate_application_status AS ENUM (
    'pending',
    'contacted',
    'approved',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.affiliate_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  canal_principal TEXT NOT NULL,
  handle_ou_url TEXT NOT NULL,
  audiencia_aprox TEXT,
  mensagem TEXT,
  status public.affiliate_application_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT affiliate_applications_nome_len CHECK (char_length(trim(nome)) BETWEEN 2 AND 80),
  CONSTRAINT affiliate_applications_email_len CHECK (char_length(trim(email)) BETWEEN 5 AND 255),
  CONSTRAINT affiliate_applications_canal_len CHECK (char_length(trim(canal_principal)) BETWEEN 2 AND 40),
  CONSTRAINT affiliate_applications_handle_len CHECK (char_length(trim(handle_ou_url)) BETWEEN 2 AND 240)
);

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_applications_email_uidx
  ON public.affiliate_applications (lower(trim(email)));

CREATE INDEX IF NOT EXISTS affiliate_applications_status_created_idx
  ON public.affiliate_applications (status, created_at DESC);

ALTER TABLE public.affiliate_applications ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.affiliate_applications IS
  'Inscrições no programa de parceiros/afiliados. Comissão fica na Kiwify; esta tabela só captura leads.';
