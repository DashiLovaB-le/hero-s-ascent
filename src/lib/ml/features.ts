/**
 * ML Fase 1 — feature engineering puro (testável, sem I/O).
 * features_version = "v1"
 */

import { calcularNivel } from "../journey";
import { hojeISO } from "@/lib/datetime";

export const FEATURES_VERSION = "v1";
export const MODEL_VERSION = "heuristic_v1";

export type HabitCompletionRow = { habit_id: string; dia: string; xp_ganho?: number | null };
export type ChallengeAggRow = {
  status: string;
  completed_at?: string | null;
  ends_at?: string | null;
  created_at?: string | null;
};

export type FeatureInput = {
  asOfDate: string; // YYYY-MM-DD (calendário America/Sao_Paulo)
  habitCountAtivo: number;
  completions: HabitCompletionRow[];
  challenges: ChallengeAggRow[];
  streak_atual: number;
  streak_maximo: number;
  xp_total: number;
  ultimo_dia_completo: string | null;
};

export type UserFeaturesV1 = {
  features_version: typeof FEATURES_VERSION;
  dias_ativos_7: number;
  dias_ativos_21: number;
  dias_sem_habito: number;
  media_habitos_dia_7: number;
  media_habitos_dia_21: number;
  taxa_conclusao_7: number;
  taxa_conclusao_21: number;
  weekday_rates: Record<string, number>; // "0".."6" → 0..1
  streak_atual: number;
  streak_maximo: number;
  xp_total: number;
  nivel: number;
  desafios_ativos: number;
  desafios_concluidos_21: number;
  desafios_expirados_21: number;
  ultimo_dia_completo: string | null;
  dias_desde_ultima_atividade: number | null;
  media_xp_dia_21: number;
};

export type MlScoresV1 = {
  model_version: typeof MODEL_VERSION;
  risco_streak: number;
  risco_abandono: number;
  projecao_dias_proximo_nivel: number | null;
  weekday_weakest: number | null;
  explicacao: {
    fatores_streak: string[];
    fatores_abandono: string[];
    weekday_weakest_label: string | null;
  };
};

const WEEKDAY_LABELS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
] as const;

function parseDay(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

function dayDiff(aIso: string, bIso: string): number {
  const a = parseDay(aIso).getTime();
  const b = parseDay(bIso).getTime();
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function addDays(iso: string, n: number): string {
  const d = parseDay(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Contagens por dia e por weekday a partir de completions. */
export function computeUserFeatures(input: FeatureInput): UserFeaturesV1 {
  const habitN = Math.max(0, input.habitCountAtivo);
  const from7 = addDays(input.asOfDate, -6);
  const from21 = addDays(input.asOfDate, -20);

  const byDay = new Map<string, number>();
  const xpByDay = new Map<string, number>();

  for (const c of input.completions) {
    if (c.dia < from21 || c.dia > input.asOfDate) continue;
    byDay.set(c.dia, (byDay.get(c.dia) ?? 0) + 1);
    const xp = typeof c.xp_ganho === "number" ? c.xp_ganho : 0;
    xpByDay.set(c.dia, (xpByDay.get(c.dia) ?? 0) + xp);
  }

  let diasAtivos7 = 0;
  let diasAtivos21 = 0;
  let sumHabits7 = 0;
  let sumHabits21 = 0;
  let sumXp21 = 0;
  let diasCompletos7 = 0;
  let diasCompletos21 = 0;

  for (let i = 0; i < 21; i++) {
    const dia = addDays(from21, i);
    const count = byDay.get(dia) ?? 0;
    const in7 = dia >= from7;
    if (count > 0) {
      diasAtivos21 += 1;
      if (in7) diasAtivos7 += 1;
    }
    sumHabits21 += count;
    sumXp21 += xpByDay.get(dia) ?? 0;
    if (in7) sumHabits7 += count;
    if (habitN > 0 && count >= habitN) {
      diasCompletos21 += 1;
      if (in7) diasCompletos7 += 1;
    }
  }

  // Weekday rates: for each weekday 0-6, among days in last 21 that fall on that weekday,
  // fraction where at least 1 habit done (or full completion if habits exist)
  const weekdayDone = Array.from({ length: 7 }, () => 0);
  const weekdayTotal = Array.from({ length: 7 }, () => 0);
  for (let i = 0; i < 21; i++) {
    const dia = addDays(from21, i);
    const wd = parseDay(dia).getUTCDay();
    weekdayTotal[wd] += 1;
    const count = byDay.get(dia) ?? 0;
    const ok = habitN > 0 ? count >= Math.max(1, Math.ceil(habitN * 0.5)) : count > 0;
    if (ok) weekdayDone[wd] += 1;
  }
  const weekday_rates: Record<string, number> = {};
  for (let wd = 0; wd < 7; wd++) {
    const t = weekdayTotal[wd] || 1;
    weekday_rates[String(wd)] = round4(weekdayDone[wd] / t);
  }

  let lastActivity: string | null = null;
  for (const dia of [...byDay.keys()].sort()) {
    if ((byDay.get(dia) ?? 0) > 0) lastActivity = dia;
  }
  if (input.ultimo_dia_completo) {
    if (!lastActivity || input.ultimo_dia_completo > lastActivity) {
      lastActivity = input.ultimo_dia_completo;
    }
  }

  const dias_desde_ultima_atividade =
    lastActivity != null ? Math.max(0, dayDiff(lastActivity, input.asOfDate)) : null;

  // Dias sem hábito: consecutive days ending at asOfDate with zero completions
  let dias_sem_habito = 0;
  for (let i = 0; i < 21; i++) {
    const dia = addDays(input.asOfDate, -i);
    if ((byDay.get(dia) ?? 0) === 0) dias_sem_habito += 1;
    else break;
  }

  const from21Chal = `${from21}T00:00:00.000Z`;
  let desafios_ativos = 0;
  let desafios_concluidos_21 = 0;
  let desafios_expirados_21 = 0;
  for (const ch of input.challenges) {
    if (ch.status === "ativo") desafios_ativos += 1;
    if (ch.status === "concluido" && ch.completed_at && ch.completed_at >= from21Chal) {
      desafios_concluidos_21 += 1;
    }
    if (ch.status === "expirado") {
      const ref = ch.ends_at ?? ch.created_at;
      if (ref && ref >= from21Chal) desafios_expirados_21 += 1;
    }
  }

  const level = calcularNivel(input.xp_total);

  return {
    features_version: FEATURES_VERSION,
    dias_ativos_7: diasAtivos7,
    dias_ativos_21: diasAtivos21,
    dias_sem_habito,
    media_habitos_dia_7: round3(sumHabits7 / 7),
    media_habitos_dia_21: round3(sumHabits21 / 21),
    taxa_conclusao_7: habitN > 0 ? round4(diasCompletos7 / 7) : round4(diasAtivos7 / 7),
    taxa_conclusao_21: habitN > 0 ? round4(diasCompletos21 / 21) : round4(diasAtivos21 / 21),
    weekday_rates,
    streak_atual: input.streak_atual,
    streak_maximo: input.streak_maximo,
    xp_total: input.xp_total,
    nivel: level.atual.nivel,
    desafios_ativos,
    desafios_concluidos_21,
    desafios_expirados_21,
    ultimo_dia_completo: input.ultimo_dia_completo,
    dias_desde_ultima_atividade,
    media_xp_dia_21: round3(sumXp21 / 21),
  };
}

export function findWeakestWeekday(rates: Record<string, number>): number | null {
  let weak: number | null = null;
  let min = Infinity;
  for (let wd = 0; wd < 7; wd++) {
    const r = rates[String(wd)];
    if (typeof r !== "number") continue;
    if (r < min) {
      min = r;
      weak = wd;
    }
  }
  return weak;
}

export function scoreUserHeuristicV1(
  features: UserFeaturesV1,
  opts?: { asOfDate?: string; tomorrowWeekday?: number },
): MlScoresV1 {
  const asOf = opts?.asOfDate ?? hojeISO();
  const tomorrowWd =
    opts?.tomorrowWeekday ??
    (() => {
      const d = parseDay(asOf);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.getUTCDay();
    })();

  const weakest = findWeakestWeekday(features.weekday_rates);
  const weakRate = weakest != null ? (features.weekday_rates[String(weakest)] ?? 1) : 1;
  const tomorrowRate = features.weekday_rates[String(tomorrowWd)] ?? 1;

  const fatores_streak: string[] = [];
  let risco_streak = 0;

  if (features.streak_atual <= 0) {
    risco_streak += 0.15;
    fatores_streak.push("sem streak ativo");
  }
  if (features.dias_sem_habito >= 1) {
    risco_streak += Math.min(0.35, 0.12 * features.dias_sem_habito);
    fatores_streak.push(`${features.dias_sem_habito} dia(s) sem hábito`);
  }
  if (features.taxa_conclusao_7 < 0.5) {
    risco_streak += 0.25;
    fatores_streak.push(`taxa 7d baixa (${Math.round(features.taxa_conclusao_7 * 100)}%)`);
  } else if (features.taxa_conclusao_7 < 0.7) {
    risco_streak += 0.12;
    fatores_streak.push(`taxa 7d moderada (${Math.round(features.taxa_conclusao_7 * 100)}%)`);
  }
  if (tomorrowRate < 0.55) {
    risco_streak += 0.22;
    fatores_streak.push(
      `amanhã é ${WEEKDAY_LABELS[tomorrowWd]} (taxa histórica ${Math.round(tomorrowRate * 100)}%)`,
    );
  }
  if (weakest != null && weakRate < 0.45 && tomorrowWd === weakest) {
    risco_streak += 0.1;
    fatores_streak.push(`amanhã coincide com o weekday mais fraco (${WEEKDAY_LABELS[weakest]})`);
  }

  risco_streak = round4(clamp01(risco_streak));

  const fatores_abandono: string[] = [];
  let risco_abandono = 0;
  const idle = features.dias_desde_ultima_atividade ?? features.dias_sem_habito;
  if (idle >= 3) {
    risco_abandono += Math.min(0.45, 0.1 * idle);
    fatores_abandono.push(`${idle} dia(s) sem atividade`);
  }
  if (features.taxa_conclusao_21 > 0.15 && features.taxa_conclusao_7 < features.taxa_conclusao_21 - 0.15) {
    risco_abandono += 0.2;
    fatores_abandono.push("queda de ritmo (7d vs 21d)");
  }
  if (features.desafios_expirados_21 >= 1) {
    risco_abandono += Math.min(0.2, 0.08 * features.desafios_expirados_21);
    fatores_abandono.push(`${features.desafios_expirados_21} desafio(s) expirado(s) em 21d`);
  }
  if (features.dias_ativos_21 <= 3) {
    risco_abandono += 0.15;
    fatores_abandono.push("poucos dias ativos nas últimas 3 semanas");
  }
  risco_abandono = round4(clamp01(risco_abandono));

  const level = calcularNivel(features.xp_total);
  let projecao: number | null = null;
  if (level.proximo && features.media_xp_dia_21 > 0) {
    projecao = Math.max(1, Math.ceil(level.xp_para_proximo / features.media_xp_dia_21));
  }

  return {
    model_version: MODEL_VERSION,
    risco_streak,
    risco_abandono,
    projecao_dias_proximo_nivel: projecao,
    weekday_weakest: weakest,
    explicacao: {
      fatores_streak,
      fatores_abandono,
      weekday_weakest_label: weakest != null ? WEEKDAY_LABELS[weakest] : null,
    },
  };
}

export function formatMlSignalsForMentor(scores: MlScoresV1 | null | undefined): string {
  if (!scores) {
    return "SINAIS ML: ainda não calculados. Não invente previsões numéricas.";
  }
  const riscoStreakPct = Math.round(scores.risco_streak * 100);
  const riscoAbdPct = Math.round(scores.risco_abandono * 100);
  const weak = scores.explicacao.weekday_weakest_label;
  const proj =
    scores.projecao_dias_proximo_nivel != null
      ? `projeção próximo nível ~${scores.projecao_dias_proximo_nivel} dia(s) no ritmo atual`
      : "projeção de nível indisponível (sem XP recente)";
  const fatores = [
    ...scores.explicacao.fatores_streak.slice(0, 3),
    ...scores.explicacao.fatores_abandono.slice(0, 2),
  ];
  return [
    `SINAIS ML (model=${scores.model_version}):`,
    `risco_streak=${riscoStreakPct}%; risco_abandono=${riscoAbdPct}%`,
    weak ? `weekday mais fraco: ${weak}` : null,
    proj,
    fatores.length ? `fatores: ${fatores.join(" | ")}` : null,
    riscoStreakPct >= 55 || riscoAbdPct >= 55
      ? "AÇÃO: priorize presença proativa e concreta — não pergunte só 'como está'."
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export { WEEKDAY_LABELS };
