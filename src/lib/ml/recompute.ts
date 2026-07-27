/**
 * Persistência ML — carrega snapshot do usuário e upsert features/scores.
 * Usado por server functions (user JWT ou service role).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  computeUserFeatures,
  scoreUserHeuristicV1,
  WEEKDAY_LABELS,
  type UserFeaturesV1,
  type MlScoresV1,
} from "@/lib/ml/features";

type Client = SupabaseClient<Database>;

/** Converte linha de `user_ml_scores` no formato usado pelo mentor. */
export function mlScoresFromRow(
  row: Database["public"]["Tables"]["user_ml_scores"]["Row"] | null | undefined,
): MlScoresV1 | null {
  if (!row) return null;
  const expl = (row.explicacao ?? {}) as {
    fatores_streak?: string[];
    fatores_abandono?: string[];
    weekday_weakest_label?: string | null;
  };
  const weak =
    row.weekday_weakest != null && row.weekday_weakest >= 0 && row.weekday_weakest <= 6
      ? row.weekday_weakest
      : null;
  return {
    model_version: (row.model_version as MlScoresV1["model_version"]) || "heuristic_v1",
    risco_streak: Number(row.risco_streak) || 0,
    risco_abandono: Number(row.risco_abandono) || 0,
    projecao_dias_proximo_nivel: row.projecao_dias_proximo_nivel,
    weekday_weakest: weak,
    explicacao: {
      fatores_streak: Array.isArray(expl.fatores_streak) ? expl.fatores_streak : [],
      fatores_abandono: Array.isArray(expl.fatores_abandono) ? expl.fatores_abandono : [],
      weekday_weakest_label:
        expl.weekday_weakest_label ??
        (weak != null ? WEEKDAY_LABELS[weak] : null),
    },
  };
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function recomputeUserMl(
  supabase: Client,
  userId: string,
  asOfDate = hojeISO(),
): Promise<{ features: UserFeaturesV1; scores: MlScoresV1 }> {
  const from21 = daysAgoISO(20);

  const [profileRes, habitsRes, compsRes, chalRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("xp_total, streak_atual, streak_maximo, ultimo_dia_completo")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("habits").select("id").eq("user_id", userId).eq("ativo", true),
    supabase
      .from("habit_completions")
      .select("habit_id, dia, xp_ganho")
      .eq("user_id", userId)
      .gte("dia", from21)
      .lte("dia", asOfDate),
    supabase
      .from("mentor_challenges")
      .select("status, completed_at, ends_at, created_at")
      .eq("user_id", userId),
  ]);

  if (profileRes.error) throw new Error(profileRes.error.message);
  if (!profileRes.data) throw new Error("Perfil não encontrado para ML.");
  if (habitsRes.error) throw new Error(habitsRes.error.message);
  if (compsRes.error) throw new Error(compsRes.error.message);
  // challenges optional if table missing
  const challenges = chalRes.error ? [] : (chalRes.data ?? []);

  const features = computeUserFeatures({
    asOfDate,
    habitCountAtivo: habitsRes.data?.length ?? 0,
    completions: compsRes.data ?? [],
    challenges,
    streak_atual: profileRes.data.streak_atual,
    streak_maximo: profileRes.data.streak_maximo,
    xp_total: profileRes.data.xp_total,
    ultimo_dia_completo: profileRes.data.ultimo_dia_completo,
  });

  const scores = scoreUserHeuristicV1(features, { asOfDate });

  const nowIso = new Date().toISOString();

  const { error: fErr } = await supabase.from("user_features").upsert(
    {
      user_id: userId,
      computed_at: nowIso,
      features_version: features.features_version,
      dias_ativos_7: features.dias_ativos_7,
      dias_ativos_21: features.dias_ativos_21,
      dias_sem_habito: features.dias_sem_habito,
      media_habitos_dia_7: features.media_habitos_dia_7,
      media_habitos_dia_21: features.media_habitos_dia_21,
      taxa_conclusao_7: features.taxa_conclusao_7,
      taxa_conclusao_21: features.taxa_conclusao_21,
      weekday_rates: features.weekday_rates as Json,
      streak_atual: features.streak_atual,
      streak_maximo: features.streak_maximo,
      xp_total: features.xp_total,
      nivel: features.nivel,
      desafios_ativos: features.desafios_ativos,
      desafios_concluidos_21: features.desafios_concluidos_21,
      desafios_expirados_21: features.desafios_expirados_21,
      ultimo_dia_completo: features.ultimo_dia_completo,
      dias_desde_ultima_atividade: features.dias_desde_ultima_atividade,
      media_xp_dia_21: features.media_xp_dia_21,
    },
    { onConflict: "user_id" },
  );
  if (fErr) {
    if (/user_features|does not exist/i.test(fErr.message)) {
      console.warn("[ml] user_features ausente — rode migration 20260727150000");
    } else {
      throw new Error(fErr.message);
    }
  }

  const { error: sErr } = await supabase.from("user_ml_scores").upsert(
    {
      user_id: userId,
      computed_at: nowIso,
      model_version: scores.model_version,
      risco_streak: scores.risco_streak,
      risco_abandono: scores.risco_abandono,
      projecao_dias_proximo_nivel: scores.projecao_dias_proximo_nivel,
      weekday_weakest: scores.weekday_weakest,
      explicacao: scores.explicacao as Json,
    },
    { onConflict: "user_id" },
  );
  if (sErr) {
    if (/user_ml_scores|does not exist/i.test(sErr.message)) {
      console.warn("[ml] user_ml_scores ausente — rode migration 20260727150000");
    } else {
      throw new Error(sErr.message);
    }
  }

  return { features, scores };
}
