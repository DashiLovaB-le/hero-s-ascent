-- Charlie Despertador: 1 alarme por usuário + eventos + flag global
create table if not exists public.charlie_alarms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  time_local time not null default '06:30',
  days_of_week smallint[] not null default '{1,2,3,4,5}',
  timezone text not null default 'America/Sao_Paulo',
  snooze_minutes int not null default 5 check (snooze_minutes between 1 and 30),
  audio_key text not null default 'classic',
  reason_text text not null default 'Hora de subir',
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.charlie_alarm_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fired_at timestamptz not null default now(),
  outcome text not null check (outcome in ('answered','dismissed','snoozed','missed','simulated')),
  platform text not null default 'android',
  call_id text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists charlie_alarm_events_user_fired_idx
  on public.charlie_alarm_events (user_id, fired_at desc);

alter table public.charlie_alarms enable row level security;
alter table public.charlie_alarm_events enable row level security;

drop policy if exists charlie_alarms_select_own on public.charlie_alarms;
create policy charlie_alarms_select_own on public.charlie_alarms
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists charlie_alarms_insert_own on public.charlie_alarms;
create policy charlie_alarms_insert_own on public.charlie_alarms
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists charlie_alarms_update_own on public.charlie_alarms;
create policy charlie_alarms_update_own on public.charlie_alarms
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists charlie_alarms_delete_own on public.charlie_alarms;
create policy charlie_alarms_delete_own on public.charlie_alarms
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists charlie_alarm_events_select_own on public.charlie_alarm_events;
create policy charlie_alarm_events_select_own on public.charlie_alarm_events
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists charlie_alarm_events_insert_own on public.charlie_alarm_events;
create policy charlie_alarm_events_insert_own on public.charlie_alarm_events
  for insert to authenticated with check (auth.uid() = user_id);

grant select, insert, update, delete on public.charlie_alarms to authenticated;
grant select, insert on public.charlie_alarm_events to authenticated;
grant all on public.charlie_alarms to service_role;
grant all on public.charlie_alarm_events to service_role;

insert into public.app_settings (key, value, updated_at)
values
  ('charlie_alarm_enabled', 'true', now()),
  ('charlie_alarm_default_reason', 'Hora de subir', now()),
  ('charlie_alarm_default_audio_key', 'classic', now())
on conflict (key) do nothing;
