import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** XP padrão por check de hábito (economia anti-farm). */
export const HABIT_XP_DEFAULT = 15;
export const HABIT_XP_SETTING_KEY = "habit_xp_reward";
export const HABIT_XP_MIN = 5;
export const HABIT_XP_MAX = 50;

let cache: { at: number; value: number } | null = null;
const CACHE_TTL_MS = 10_000;

export function invalidateHabitXpCache() {
  cache = null;
}

function clampHabitXp(n: number): number {
  if (!Number.isFinite(n)) return HABIT_XP_DEFAULT;
  return Math.min(HABIT_XP_MAX, Math.max(HABIT_XP_MIN, Math.round(n)));
}

/** Lê o XP fixo de hábitos (app_settings), com cache curto. */
export async function resolveHabitXpReward(): Promise<number> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;

  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", HABIT_XP_SETTING_KEY)
    .maybeSingle();

  const raw = data?.value?.trim();
  const parsed = raw ? Number(raw) : HABIT_XP_DEFAULT;
  const value = clampHabitXp(Number.isFinite(parsed) ? parsed : HABIT_XP_DEFAULT);
  cache = { at: Date.now(), value };
  return value;
}

export async function setHabitXpReward(xp: number, updatedBy: string): Promise<number> {
  const value = clampHabitXp(xp);
  const { error } = await supabaseAdmin.from("app_settings").upsert(
    {
      key: HABIT_XP_SETTING_KEY,
      value: String(value),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  invalidateHabitXpCache();
  return value;
}
