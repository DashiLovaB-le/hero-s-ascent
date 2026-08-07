-- Charlie wisdom cards (curated principles for mentor context)

CREATE TABLE IF NOT EXISTS public.charlie_wisdom_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  titulo TEXT NOT NULL,
  principio TEXT NOT NULL,
  quando_usar TEXT NOT NULL DEFAULT '',
  quando_evitar TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  blocked_personalities TEXT[] NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT charlie_wisdom_cards_source_check CHECK (
    source IN (
      'habitos_atomicos',
      'poder_do_habito',
      'coragem_imperfeito',
      'meditacoes',
      'obstaculo_caminho'
    )
  ),
  CONSTRAINT charlie_wisdom_cards_titulo_len CHECK (char_length(trim(titulo)) BETWEEN 1 AND 120),
  CONSTRAINT charlie_wisdom_cards_principio_len CHECK (char_length(trim(principio)) BETWEEN 1 AND 800)
);

CREATE INDEX IF NOT EXISTS charlie_wisdom_cards_ativo_priority_idx
  ON public.charlie_wisdom_cards (ativo, priority DESC);

CREATE INDEX IF NOT EXISTS charlie_wisdom_cards_source_idx
  ON public.charlie_wisdom_cards (source);

ALTER TABLE public.charlie_wisdom_cards ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.charlie_wisdom_cards IS
  'Fichas de sabedoria do Charlie (princípios curados). Escrita via service role / admin.';
