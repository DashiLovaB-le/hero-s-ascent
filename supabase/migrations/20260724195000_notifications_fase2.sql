-- =============================================================================
-- Notificações Fase 2 — tipos de produto + anti-spam
-- =============================================================================

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_tipo_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_tipo_check CHECK (
    tipo IN (
      'mentor_challenge',
      'mentor_challenge_done',
      'mentor_challenge_expired',
      'habit_complete',
      'habit_reminder',
      'streak_risk',
      'mentor_presence',
      'achievement',
      'system'
    )
  );

-- Máx. 1 reminder/streak por usuário por dia (UTC)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_tipo_day
  ON public.notifications (
    user_id,
    tipo,
    ((timezone('utc', created_at))::date)
  )
  WHERE tipo IN ('habit_reminder', 'streak_risk');
