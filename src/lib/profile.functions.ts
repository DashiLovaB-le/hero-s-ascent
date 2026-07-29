import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addDaysToDateKey, eachDateKeyInclusive, hojeISO } from "@/lib/datetime";
import { loadLevelsFromDb, loadWallpapersFromDb } from "@/lib/catalog.server";

const PROFILE_COLS =
  "id, nome, avatar_url, bio, xp_total, streak_atual, streak_maximo, ultimo_dia_completo, capitulo_atual, frase_motivacional, onboarding_completo, created_at, location_label, location_lat, location_lon, location_timezone";
const ATTR_COLS =
  "user_id, forca, disciplina, sabedoria, espirito, testosterona, prosperidade, conhecimento, lideranca";
const PROFILE_COLS_LEGACY =
  "id, nome, avatar_url, bio, xp_total, streak_atual, streak_maximo, ultimo_dia_completo, capitulo_atual, frase_motivacional, onboarding_completo, created_at";
const CHALLENGE_COLS =
  "id, titulo, descricao, duracao_dias, xp_recompensa, titulo_recompensa, status, starts_at, ends_at, completed_at, created_at";

function daysAgoISO(n: number) {
  return addDaysToDateKey(hojeISO(), -n);
}

function enumerateDays(fromIso: string, toIso: string) {
  return eachDateKeyInclusive(fromIso, toIso);
}

function bestActiveStreak(activeDays: Set<string>, days: string[]) {
  let best = 0;
  let run = 0;
  for (const dia of days) {
    if (activeDays.has(dia)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

function asError(label: string, err: { message?: string } | null | undefined): Error {
  return new Error(`Falha ao carregar ${label}: ${err?.message ?? "erro desconhecido"}`);
}

/** Panorama agregado do herói para /profile */
export const getProfilePanorama = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const hoje = hojeISO();
    const from21 = daysAgoISO(20);

    const [profileRes0, attrsRes, habitsRes, goalsRes, compsRes, achRes, chalRes] =
      await Promise.all([
        supabase.from("profiles").select(PROFILE_COLS).eq("id", userId).maybeSingle(),
        supabase.from("attributes").select(ATTR_COLS).eq("user_id", userId).maybeSingle(),
        supabase.from("habits").select("id").eq("user_id", userId).eq("ativo", true),
        supabase
          .from("goals")
          .select("id, titulo, categoria, ativo, created_at")
          .eq("user_id", userId)
          .eq("ativo", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("habit_completions")
          .select("habit_id, dia")
          .eq("user_id", userId)
          .gte("dia", from21)
          .lte("dia", hoje),
        supabase
          .from("user_achievements")
          .select("achievement_id, desbloqueado_em, achievements(codigo, titulo, descricao, icone)")
          .eq("user_id", userId)
          .order("desbloqueado_em", { ascending: false })
          .limit(12),
        supabase
          .from("mentor_challenges")
          .select(CHALLENGE_COLS)
          .eq("user_id", userId)
          .eq("status", "concluido")
          .order("completed_at", { ascending: false })
          .limit(12),
      ]);

    let profileRes = profileRes0;
    if (profileRes.error && /location_/i.test(profileRes.error.message)) {
      profileRes = await supabase
        .from("profiles")
        .select(PROFILE_COLS_LEGACY)
        .eq("id", userId)
        .maybeSingle();
    }

    // Essenciais — se falhar, página não abre
    if (profileRes.error) throw asError("profiles", profileRes.error);
    if (attrsRes.error) throw asError("attributes", attrsRes.error);
    if (habitsRes.error) throw asError("habits", habitsRes.error);
    if (goalsRes.error) throw asError("goals", goalsRes.error);
    if (compsRes.error) throw asError("habit_completions", compsRes.error);

    // Opcionais — conquistas/desafios do Charlie não podem derrubar o perfil
    const achievements = achRes.error ? [] : (achRes.data ?? []);
    const completedChallenges = chalRes.error ? [] : (chalRes.data ?? []);
    if (achRes.error) console.warn("[profile] achievements:", achRes.error.message);
    if (chalRes.error) console.warn("[profile] mentor_challenges:", chalRes.error.message);

    if (!profileRes.data || !attrsRes.data) {
      throw new Error("Perfil incompleto. Abra a Jornada antes.");
    }

    const habitCount = habitsRes.data?.length ?? 0;
    const completions = compsRes.data ?? [];
    const days = enumerateDays(from21, hoje);

    const byDay = new Map<string, number>();
    for (const c of completions) {
      byDay.set(c.dia, (byDay.get(c.dia) ?? 0) + 1);
    }

    const rhythmDays = days.map((dia) => {
      const count = byDay.get(dia) ?? 0;
      const d = new Date(`${dia}T12:00:00`);
      return {
        dia,
        count,
        weekday: d.getDay(),
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      };
    });

    const activeDaySet = new Set(rhythmDays.filter((d) => d.count > 0).map((d) => d.dia));
    const totalCompletions = completions.length;
    const possible = Math.max(1, habitCount * days.length);
    const completionRate = Math.min(100, Math.round((totalCompletions / possible) * 100));

    const createdAt = profileRes.data.created_at ?? new Date().toISOString();
    const daysOnJourney = Math.max(
      1,
      Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)) + 1,
    );

    const [levels, wallpapers] = await Promise.all([
      loadLevelsFromDb(),
      loadWallpapersFromDb(),
    ]);

    return {
      profile: profileRes.data,
      attributes: attrsRes.data,
      goals: goalsRes.data ?? [],
      achievements,
      completedChallenges,
      daysOnJourney,
      levels,
      wallpapers,
      rhythm: {
        days: rhythmDays,
        periodDays: days.length,
        habitCount,
        totalCompletions,
        activeDays: activeDaySet.size,
        completionRate,
        bestStreakInPeriod: bestActiveStreak(activeDaySet, days),
      },
    };
  });
