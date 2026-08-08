-- Align ringtone keys with native assets (classic | warrior | calm)
alter table public.charlie_alarms
  alter column audio_key set default 'classic';

update public.charlie_alarms
set audio_key = 'classic'
where audio_key in ('classico', '') or audio_key is null;

update public.app_settings
set value = 'classic', updated_at = now()
where key = 'charlie_alarm_default_audio_key'
  and value in ('classico', '');

insert into public.app_settings (key, value, updated_at)
values ('charlie_alarm_default_audio_key', 'classic', now())
on conflict (key) do nothing;
