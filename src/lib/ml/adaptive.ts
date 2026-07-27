/**
 * ML Fase 3 — decisões adaptativas puras (sem I/O).
 * Fonte: user_ml_scores / heuristic_v1 — nunca shadow.
 */

export const ML_MOD = 0.35;
export const ML_HIGH = 0.55;
export const ML_QUIET = 0.35; // abaixo = “baixo” para anti-spam

export type AdaptiveScores = {
  risco_streak: number;
  risco_abandono: number;
  weekday_weakest: number | null;
  weekday_weakest_label: string | null;
};

export type ReminderDecision = {
  sendHabitReminder: boolean;
  sendStreakRisk: boolean;
  habitTitulo: string;
  habitCorpo: string;
  streakTitulo: string;
  streakCorpo: string;
  reasons: string[];
  metadataExtra: {
    ml_guided: boolean;
    risco_streak: number | null;
    risco_abandono: number | null;
  };
};

export type ChallengePolicy = {
  allowNewChallenge: boolean;
  preferSoftChallenge: boolean;
  maxDuracaoDias: number;
  maxXp: number;
  maxCompletionsRequired: number;
  maxActive: number;
  promptHint: string;
  reasons: string[];
};

export type ChallengeDraft = {
  titulo: string;
  descricao: string;
  duracao_dias: number;
  xp_recompensa: number;
  titulo_recompensa?: string | null;
  habit_id?: string | null;
  completions_required?: number;
};

function band(n: number): "baixo" | "moderado" | "alto" {
  if (n >= ML_HIGH) return "alto";
  if (n >= ML_MOD) return "moderado";
  return "baixo";
}

export function scoresFromMlRow(row: {
  risco_streak?: number | null;
  risco_abandono?: number | null;
  weekday_weakest?: number | null;
  explicacao?: unknown;
} | null | undefined): AdaptiveScores | null {
  if (!row) return null;
  const expl = (row.explicacao ?? {}) as { weekday_weakest_label?: string | null };
  return {
    risco_streak: Number(row.risco_streak) || 0,
    risco_abandono: Number(row.risco_abandono) || 0,
    weekday_weakest:
      row.weekday_weakest != null && row.weekday_weakest >= 0 && row.weekday_weakest <= 6
        ? row.weekday_weakest
        : null,
    weekday_weakest_label: expl.weekday_weakest_label ?? null,
  };
}

/**
 * Decide habit_reminder + streak_risk com guardrails de anti-spam / escalonamento.
 */
export function decideReminders(input: {
  scores: AdaptiveScores | null;
  pending: number;
  allDone: boolean;
  streakAtual: number;
  ultimoDiaCompleto: string | null;
  hoje: string;
}): ReminderDecision {
  const reasons: string[] = [];
  const s = input.scores;
  const riscoS = s?.risco_streak ?? null;
  const riscoA = s?.risco_abandono ?? null;

  const classicStreakRisk =
    input.streakAtual > 0 &&
    input.ultimoDiaCompleto !== input.hoje &&
    !input.allDone;

  let sendHabitReminder = !input.allDone && input.pending > 0;
  let sendStreakRisk = classicStreakRisk;

  // Anti-spam: usuário estável, só 1 pendente → pular habit_reminder
  if (
    sendHabitReminder &&
    input.pending === 1 &&
    s &&
    s.risco_streak < ML_QUIET &&
    s.risco_abandono < ML_QUIET
  ) {
    sendHabitReminder = false;
    reasons.push("skip_habit_reminder_low_risk_one_pending");
  }

  // Escalonar streak se ML alto (reforça classic)
  if (s && s.risco_streak >= ML_HIGH && input.streakAtual > 0 && !input.allDone) {
    sendStreakRisk = true;
    reasons.push("force_streak_risk_ml_high");
  }

  let habitTitulo = "Missões do dia em aberto";
  let habitCorpo =
    input.pending === 1
      ? "Ainda falta 1 hábito hoje. Mantém o ritmo."
      : `Ainda faltam ${input.pending} hábitos hoje. Mantém o ritmo.`;

  if (s && s.risco_abandono >= ML_HIGH && sendHabitReminder) {
    habitTitulo = "Não quebre o ritmo hoje";
    habitCorpo =
      input.pending === 1
        ? "Um hábito ainda aberto — feche o dia antes que a ausência vire hábito."
        : `${input.pending} hábitos em aberto. Volte agora; o ritmo está em risco.`;
    reasons.push("escalate_habit_reminder_abandono_high");
  } else if (s && s.risco_abandono >= ML_MOD && sendHabitReminder) {
    habitCorpo =
      input.pending === 1
        ? "Ainda falta 1 hábito. Um passo curto basta."
        : `Faltam ${input.pending} hábitos. Um de cada vez.`;
    reasons.push("soften_habit_reminder_abandono_mod");
  }

  let streakTitulo = "Sua streak está em risco";
  let streakCorpo = `Sequência de ${input.streakAtual} dias — conclua um hábito hoje.`;

  if (s && s.risco_streak >= ML_HIGH && sendStreakRisk) {
    streakTitulo = "Streak em risco alto";
    const weak = s.weekday_weakest_label;
    streakCorpo = weak
      ? `Sequência de ${input.streakAtual} dias. Seu padrão fraco costuma ser ${weak} — não deixe hoje seguir o mesmo caminho.`
      : `Sequência de ${input.streakAtual} dias sob pressão. Conclua ao menos um hábito hoje.`;
    reasons.push("escalate_streak_risk_ml_high");
  } else if (s && s.risco_streak >= ML_MOD && sendStreakRisk) {
    streakCorpo = `Sequência de ${input.streakAtual} dias. Um hábito hoje segura o ritmo.`;
    reasons.push("nudge_streak_risk_ml_mod");
  }

  if (!s) reasons.push("no_ml_scores_fallback_classic");

  return {
    sendHabitReminder,
    sendStreakRisk,
    habitTitulo,
    habitCorpo,
    streakTitulo,
    streakCorpo,
    reasons,
    metadataExtra: {
      ml_guided: Boolean(s),
      risco_streak: riscoS,
      risco_abandono: riscoA,
    },
  };
}

/**
 * Política de desafios para Charlie (clamp + cooldown).
 */
export function decideChallengePolicy(input: {
  scores: AdaptiveScores | null;
  activeChallengeCount: number;
  challengesCreatedLast48h: number;
}): ChallengePolicy {
  const reasons: string[] = [];
  const maxActive = 2;
  const s = input.scores;
  const high = Boolean(
    s && (s.risco_streak >= ML_HIGH || s.risco_abandono >= ML_HIGH),
  );
  const mod = Boolean(
    s && (s.risco_streak >= ML_MOD || s.risco_abandono >= ML_MOD),
  );

  let allowNewChallenge = input.activeChallengeCount < maxActive;
  let preferSoftChallenge = false;
  let maxDuracaoDias = 7;
  let maxXp = 500;
  let maxCompletionsRequired = 7;

  if (high) {
    preferSoftChallenge = true;
    maxDuracaoDias = 2;
    maxXp = 120;
    maxCompletionsRequired = 2;
    reasons.push("soft_caps_risk_high");
    if (input.challengesCreatedLast48h >= 1 && input.activeChallengeCount > 0) {
      allowNewChallenge = false;
      reasons.push("cooldown_48h_with_active");
    }
  } else if (mod) {
    preferSoftChallenge = true;
    maxDuracaoDias = 3;
    maxXp = 200;
    maxCompletionsRequired = 3;
    reasons.push("soft_caps_risk_mod");
  }

  if (input.activeChallengeCount >= maxActive) {
    allowNewChallenge = false;
    reasons.push("max_active_reached");
  }

  const promptHint = high
    ? `POLÍTICA ADAPTATIVA: risco alto (streak=${s ? Math.round(s.risco_streak * 100) : "?"}% abandono=${s ? Math.round(s.risco_abandono * 100) : "?"}%). ${
        allowNewChallenge
          ? "Se propor desafio, prefira 1 dia, 1 conclusão, XP ≤ 120, vinculado a um hábito pendente se possível."
          : "NÃO proponha novo desafio agora (cooldown/ativos)."
      }`
    : mod
      ? `POLÍTICA ADAPTATIVA: risco moderado. Desafio no máximo 3 dias, XP ≤ 200, até 3 conclusões.`
      : `POLÍTICA ADAPTATIVA: risco baixo/estável. Desafio só se houver gancho narrativo claro.`;

  return {
    allowNewChallenge,
    preferSoftChallenge,
    maxDuracaoDias,
    maxXp,
    maxCompletionsRequired,
    maxActive,
    promptHint,
    reasons,
  };
}

/** Aplica tetos; retorna null se política bloqueia. */
export function applyChallengeGuardrails(
  challenge: ChallengeDraft,
  policy: ChallengePolicy,
): ChallengeDraft | null {
  if (!policy.allowNewChallenge) return null;

  const duracao = Math.min(
    policy.maxDuracaoDias,
    Math.max(1, Math.round(challenge.duracao_dias) || 1),
  );
  const xp = Math.min(
    policy.maxXp,
    Math.max(10, Math.round(challenge.xp_recompensa) || 50),
  );
  const completions = Math.min(
    policy.maxCompletionsRequired,
    Math.max(1, Math.round(challenge.completions_required ?? 1) || 1),
  );

  return {
    ...challenge,
    duracao_dias: duracao,
    xp_recompensa: xp,
    completions_required: completions,
  };
}

export { band };
