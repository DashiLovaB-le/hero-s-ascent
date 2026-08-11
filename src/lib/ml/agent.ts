/**
 * ML Fase 4 — motor do agente (puro, testável).
 * Nunca cria desafio; só decide se/qual iniciativa emitir.
 * Fase 3 Alter Ego: copy alinhada ao inimigo/código quando disponível.
 */

import { ML_HIGH, ML_MOD, type AdaptiveScores } from "@/lib/ml/adaptive";
import { hourInTz } from "@/lib/datetime";

export type AgentKind = "checkin_nudge" | "streak_protect" | "cf_habit_hint";

export type AgentAlterEgoHint = {
  nome: string;
  inimigo: string;
  /** Primeira linha do código (citável). */
  codigoLine: string | null;
};

export type AgentDecision = {
  create: boolean;
  kind: AgentKind | null;
  titulo: string;
  corpo: string;
  href: string;
  reasons: string[];
  /** Metadata para voz/notificação (sem spam em hábitos triviais). */
  identityMeta?: {
    alter_ego_nome?: string;
    identity_inimigo?: string;
    identity_codigo?: string;
  };
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
  /** Alter Ego do herói — só altera copy, não cria kind novo. */
  alterEgo?: AgentAlterEgoHint | null;
  /** Risco de identidade 0–1 (de ML Fase 3). */
  riscoIdentidade?: number | null;
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
  const riscoId = input.riscoIdentidade ?? 0;
  const ego = input.alterEgo;
  const identityMeta = ego
    ? {
        alter_ego_nome: ego.nome,
        identity_inimigo: ego.inimigo,
        identity_codigo: ego.codigoLine ?? undefined,
      }
    : undefined;

  // Prioridade 1: proteger streak (reforça com identidade se risco alto)
  if (riscoS >= ML_HIGH || (riscoS >= ML_MOD && riscoId >= ML_HIGH)) {
    reasons.push(riscoS >= ML_HIGH ? "streak_protect_high" : "streak_protect_identity");
    const weak = s?.weekday_weakest_label;
    let corpo: string;
    let titulo: string;
    if (ego?.codigoLine) {
      titulo = "Proteja o código";
      corpo = weak
        ? `Risco de streak. Seu padrão fraco costuma ser ${weak}. Lembre: "${ego.codigoLine}" — um hábito hoje.`
        : `Risco de streak. Lembre: "${ego.codigoLine}" — um hábito hoje segura quem você decidiu ser.`;
      if (ego.inimigo) {
        corpo += ` Não alimente ${ego.inimigo.toLowerCase()}.`;
      }
    } else {
      titulo = "Iniciativa: proteja sua sequência";
      corpo = weak
        ? `Risco de streak alto. Seu padrão fraco costuma ser ${weak}. Fale com o Charlie ou feche um hábito hoje.`
        : "Risco de streak alto. Um hábito hoje segura o ritmo — o Charlie pode orientar.";
    }
    return {
      create: true,
      kind: "streak_protect",
      titulo,
      corpo,
      href: ego ? "/identity" : "/habits",
      reasons,
      identityMeta,
    };
  }

  // Prioridade 2: check-in ausente após o amanhecer (ou risco moderado)
  const hour = input.hourLocalApprox ?? hourInTz();
  const pastMorning = hour >= 8;
  if (
    !input.hasCheckinToday &&
    (riscoA >= ML_MOD || riscoS >= ML_MOD || riscoId >= ML_MOD || pastMorning)
  ) {
    reasons.push("checkin_nudge");
    const corpo = ego
      ? `Registre sono, energia, humor e se agiu como ${ego.nome} — sem XP na identidade, só verdade.`
      : "Registre sono, energia e humor na Jornada — o Charlie usa isso com parcimônia.";
    return {
      create: true,
      kind: "checkin_nudge",
      titulo: ego ? "Check-in + identidade" : "Check-in do dia",
      corpo,
      href: "/journey",
      reasons,
      identityMeta,
    };
  }

  // Prioridade 3: dica CF (sem forçar identidade — evita spam)
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
