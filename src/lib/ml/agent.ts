/**
 * ML Fase 4 — motor do agente (puro, testável).
 * Nunca cria desafio; só decide se/qual iniciativa emitir.
 */

import { ML_HIGH, ML_MOD, type AdaptiveScores } from "@/lib/ml/adaptive";

export type AgentKind = "checkin_nudge" | "streak_protect" | "cf_habit_hint";

export type AgentDecision = {
  create: boolean;
  kind: AgentKind | null;
  titulo: string;
  corpo: string;
  href: string;
  reasons: string[];
};

export type CfSuggestion = {
  titulo: string;
  atributo?: string | null;
  score: number;
  from_peers: number;
};

const MIN_CF_PEERS = 5;

export function decideAgentInitiative(input: {
  scores: AdaptiveScores | null;
  hasCheckinToday: boolean;
  hasPendingInitiative: boolean;
  alreadyNotifiedToday: boolean;
  quietHours: boolean;
  cfSuggestion: CfSuggestion | null;
  hourLocalApprox?: number;
}): AgentDecision {
  const reasons: string[] = [];

  if (input.quietHours) {
    return empty("quiet_hours");
  }
  if (input.hasPendingInitiative) {
    return empty("pending_exists");
  }
  if (input.alreadyNotifiedToday) {
    return empty("already_notified_today");
  }

  const s = input.scores;
  const riscoS = s?.risco_streak ?? 0;
  const riscoA = s?.risco_abandono ?? 0;

  // Prioridade 1: proteger streak
  if (riscoS >= ML_HIGH) {
    reasons.push("streak_protect_high");
    return {
      create: true,
      kind: "streak_protect",
      titulo: "Iniciativa: proteja sua sequência",
      corpo: s?.weekday_weakest_label
        ? `Risco de streak alto. Seu padrão fraco costuma ser ${s.weekday_weakest_label}. Fale com o Charlie ou feche um hábito hoje.`
        : "Risco de streak alto. Um hábito hoje segura o ritmo — o Charlie pode orientar.",
      href: "/habits",
      reasons,
    };
  }

  // Prioridade 2: check-in ausente + risco moderado/alto OU noite
  const hour = input.hourLocalApprox ?? new Date().getHours();
  const evening = hour >= 20 || hour < 2;
  if (
    !input.hasCheckinToday &&
    (riscoA >= ML_MOD || riscoS >= ML_MOD || evening)
  ) {
    reasons.push("checkin_nudge");
    return {
      create: true,
      kind: "checkin_nudge",
      titulo: "Check-in do dia",
      corpo: "Registre sono, energia e humor na Jornada — o Charlie usa isso com parcimônia.",
      href: "/journey",
      reasons,
    };
  }

  // Prioridade 3: dica CF
  if (input.cfSuggestion && input.cfSuggestion.from_peers >= MIN_CF_PEERS) {
    reasons.push("cf_habit_hint");
    return {
      create: true,
      kind: "cf_habit_hint",
      titulo: "Ideia de quem caminha parecido",
      corpo: `Heróis com ritmo similar costumam manter “${input.cfSuggestion.titulo}”. Vale considerar — sem obrigação.`,
      href: "/habits",
      reasons,
    };
  }

  return empty("no_trigger");
}

function empty(reason: string): AgentDecision {
  return {
    create: false,
    kind: null,
    titulo: "",
    corpo: "",
    href: "/mentor",
    reasons: [reason],
  };
}

export { MIN_CF_PEERS };
