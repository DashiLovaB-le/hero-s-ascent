-- =============================================================================
-- Relatório de identidade (evening) — notificação espelhada Telegram/Discord
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
      'system',
      'agent_initiative',
      'identity_report'
    )
  );

-- Máx. 1 relatório de identidade por usuário por dia (UTC date key — alinhado aos outros reminders)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_identity_report_day
  ON public.notifications (
    user_id,
    tipo,
    ((timezone('utc', created_at))::date)
  )
  WHERE tipo = 'identity_report';
