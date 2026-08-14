-- Rate limit durável (habit-suggest etc.) + INSERT mentor só role=user

CREATE TABLE IF NOT EXISTS public.user_rate_limits (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  last_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_start DATE NOT NULL DEFAULT ((timezone('utc', now()))::date),
  window_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, action),
  CONSTRAINT user_rate_limits_action_len CHECK (char_length(trim(action)) BETWEEN 1 AND 64),
  CONSTRAINT user_rate_limits_count_nonneg CHECK (window_count >= 0)
);

ALTER TABLE public.user_rate_limits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.user_rate_limits TO service_role;
REVOKE ALL ON public.user_rate_limits FROM PUBLIC, authenticated, anon;

CREATE OR REPLACE FUNCTION public.consume_user_rate_limit(
  p_user_id uuid,
  p_action text,
  p_min_interval_ms integer,
  p_daily_max integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.user_rate_limits%ROWTYPE;
  today date := (timezone('utc', now()))::date;
  action_key text := lower(trim(p_action));
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_user_id IS NULL OR action_key = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  IF p_min_interval_ms < 0 OR p_daily_max < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  INSERT INTO public.user_rate_limits (user_id, action, last_at, window_start, window_count)
  VALUES (p_user_id, action_key, timestamptz '1970-01-01+00', today, 0)
  ON CONFLICT (user_id, action) DO NOTHING;

  SELECT * INTO rec
  FROM public.user_rate_limits
  WHERE user_id = p_user_id AND action = action_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  IF rec.window_start <> today THEN
    rec.window_start := today;
    rec.window_count := 0;
  END IF;

  IF rec.last_at > timestamptz '1970-01-02+00'
     AND (EXTRACT(EPOCH FROM (now() - rec.last_at)) * 1000) < p_min_interval_ms THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'interval');
  END IF;

  IF rec.window_count >= p_daily_max THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'daily');
  END IF;

  UPDATE public.user_rate_limits
  SET last_at = now(),
      window_start = rec.window_start,
      window_count = rec.window_count + 1
  WHERE user_id = p_user_id AND action = action_key;

  RETURN jsonb_build_object('ok', true, 'count', rec.window_count + 1);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_user_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_user_rate_limit(uuid, text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.openrouter_daily_usage(
  p_since timestamptz,
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN jsonb_build_object(
    'global_tokens', coalesce((
      SELECT sum(total_tokens) FROM public.ai_usage_events WHERE created_at >= p_since
    ), 0),
    'global_cost', coalesce((
      SELECT sum(estimated_cost_usd) FROM public.ai_usage_events WHERE created_at >= p_since
    ), 0),
    'user_tokens', CASE
      WHEN p_user_id IS NULL THEN 0
      ELSE coalesce((
        SELECT sum(total_tokens)
        FROM public.ai_usage_events
        WHERE created_at >= p_since AND user_id = p_user_id
      ), 0)
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.openrouter_daily_usage(timestamptz, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.openrouter_daily_usage(timestamptz, uuid) TO service_role;

-- Client JWT só pode inserir mensagens do herói; assistant fica no service role.
DROP POLICY IF EXISTS "Inserir próprias mensagens do mentor" ON public.mentor_messages;
CREATE POLICY "Inserir próprias mensagens do mentor"
  ON public.mentor_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'user');
