-- Agenda diária: Edge Function agent-initiatives-job (04:00 UTC)
-- Não recria pg_cron (evita erro 2BP01).

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE EXCEPTION
      'Extensão pg_cron ausente. Habilite em Database → Extensions.';
  END IF;
END $$;

DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'agent-initiatives-job-daily';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'agent-initiatives-job-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gmzddccyikpxbiozsiue.supabase.co/functions/v1/agent-initiatives-job',
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
