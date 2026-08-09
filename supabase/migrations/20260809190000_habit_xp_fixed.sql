-- Hábitos: XP fixo do sistema (anti-farm) + default alinhado
alter table public.habits
  alter column xp_recompensa set default 15;

update public.habits
set xp_recompensa = 15
where xp_recompensa is distinct from 15
  and exercise_type_id is null;

insert into public.app_settings (key, value, updated_at)
values ('habit_xp_reward', '15', now())
on conflict (key) do update
set value = excluded.value,
    updated_at = excluded.updated_at;
