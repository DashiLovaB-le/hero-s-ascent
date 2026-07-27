-- =============================================================================
-- Agenda diária: Edge Function ml-features-job (03:00 UTC)
-- Assume pg_cron + pg_net + vault secret já existentes (notification-jobs).
-- Não recria extensões: CREATE EXTENSION pg_cron falha com 2BP01 em projetos
-- onde os grants do after-create.sql já foram aplicados.
-- =============================================================================

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE EXCEPTION
      'Extensão pg_cron ausente. Habilite em Database → Extensions antes de rodar este schedule.';
  END IF;
END $$;

DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'ml-features-job-daily';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'ml-features-job-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gmzddccyikpxbiozsiue.supabase.co/functions/v1/ml-features-job',
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
    timeout_milliseconds := 120000
  );
  $$
);
