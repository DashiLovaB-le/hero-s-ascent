-- Native push device tokens (FCM / APNs via Capacitor)

CREATE TABLE IF NOT EXISTS public.push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  token TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT push_devices_token_len CHECK (char_length(trim(token)) BETWEEN 8 AND 512)
);

CREATE UNIQUE INDEX IF NOT EXISTS push_devices_token_uidx
  ON public.push_devices (token);

CREATE INDEX IF NOT EXISTS push_devices_user_enabled_idx
  ON public.push_devices (user_id, enabled);

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_devices_select_own"
  ON public.push_devices FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "push_devices_insert_own"
  ON public.push_devices FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_devices_update_own"
  ON public.push_devices FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_devices_delete_own"
  ON public.push_devices FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.push_devices IS
  'Tokens FCM/APNs do app Capacitor. Web Push continua em push_subscriptions.';
