-- Bootstrap de getJourney usa upsert em attributes; sem INSERT o RLS bloqueia e a /journey fica em branco.
DROP POLICY IF EXISTS "Inserir próprios atributos" ON public.attributes;
CREATE POLICY "Inserir próprios atributos"
  ON public.attributes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
