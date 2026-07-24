-- =============================================================================
-- Agenda diária: Edge Function notification-jobs (20:00 UTC)
-- Requer extensões pg_cron + pg_net (habilite em Database → Extensions se faltar)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Guarda o segredo no Vault (idempotente: só cria se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM vault.secrets
    WHERE name = 'notification_jobs_cron_secret'
  ) THEN
    PERFORM vault.create_secret(
      'vproject_cron_a8f3k2m9q1x7',
      'notification_jobs_cron_secret',
      'Header x-cron-secret para Edge Function notification-jobs'
    );
  END IF;
END $$;

-- Remove job antigo com o mesmo nome (reaplicável)
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'notification-jobs-daily';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

-- Dispara POST na Edge Function todo dia às 22:00 América/São_Paulo (= 01:00 UTC)
SELECT cron.schedule(
  'notification-jobs-daily',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gmzddccyikpxbiozsiue.supabase.co/functions/v1/notification-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'notification_jobs_cron_secret'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
