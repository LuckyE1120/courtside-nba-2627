-- Run after the journal tables and Edge Function have been deployed.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select vault.create_secret(
  encode(gen_random_bytes(32), 'hex'),
  'journal_cron_token',
  'Secret used only by the NBA journal scheduler'
);

create or replace function public.verify_journal_cron_token(supplied_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'journal_cron_token' and decrypted_secret = supplied_token
  );
$$;

revoke all on function public.verify_journal_cron_token(text) from public, anon, authenticated;
grant execute on function public.verify_journal_cron_token(text) to service_role;

select cron.schedule(
  'generate-nba-viewing-diaries',
  '0 2 * * *', -- 10:00 Asia/Shanghai each day
  $job$
    select net.http_post(
      url := 'https://nwsgpypynmyeyuktnxpx.supabase.co/functions/v1/journal-generate',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-token', (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'journal_cron_token'
        )
      ),
      body := '{"scheduled":true}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);
