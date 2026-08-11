/**
 * ML Fase 3 / Alter Ego — aderência heurística à identidade (puro, testável).
 * Score alto = age alinhado ao código; risco_identidade = 1 - aderência.
 */

export type IdentidadeCheck = "sim" | "parcial" | "nao" | null | undefined;

export type IdentitySignalsInput = {
  hasAlterEgo: boolean;
  proofsWeek: number;
  /** Check-ins de identidade dos últimos ~7 dias (mais recente primeiro ou qualquer ordem). */
  checkinsIdentidade: IdentidadeCheck[];
  /** Taxa de conclusão de hábitos 7d (0–1). */
  taxaConclusao7: number;
  /** Fração de skips no atributo ligado ao inimigo (0–1); null = sem dado. */
  enemySkipRate?: number | null;
  inimigo?: string | null;
};

export type IdentityAdherenceResult = {
  /** 0–1 (maior = mais alinhado). */
  identity_adherence: number;
  /** 0–1 (maior = mais risco de negociar com o código). */
  risco_identidade: number;
  principal_risco: string | null;
  fatores: string[];
};

const ENEMY_TO_ATTR: Record<string, string> = {
  procrastinação: "disciplina",
  procrastinacao: "disciplina",
  "falta de disciplina": "disciplina",
  distrações: "disciplina",
  distracoes: "disciplina",
  "falta de energia": "forca",
  medo: "espirito",
  desorganização: "disciplina",
  desorganizacao: "disciplina",
  desistência: "disciplina",
  desistencia: "disciplina",
};

export function mapInimigoToAtributo(inimigo: string | null | undefined): string | null {
  if (!inimigo?.trim()) return null;
  const key = inimigo
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const compact = key.replace(/\s+/g, " ");
  for (const [needle, attr] of Object.entries(ENEMY_TO_ATTR)) {
    const n = needle.normalize("NFD").replace(/\p{M}/gu, "");
    if (compact.includes(n)) return attr;
  }
  return "disciplina";
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Heurística: conclusão 7d + provas/semana + check-ins de identidade + skips do inimigo.
 */
export function scoreIdentityAdherence(input: IdentitySignalsInput): IdentityAdherenceResult {
  if (!input.hasAlterEgo) {
    return {
      identity_adherence: 0,
      risco_identidade: 0,
      principal_risco: null,
      fatores: ["alter ego ainda não definido"],
    };
  }

  const fatores: string[] = [];
  let score = 0.45; // base neutra com identidade definida

  // Taxa de cumprimento (peso forte)
  const taxa = clamp01(input.taxaConclusao7);
  score += (taxa - 0.5) * 0.4;
  if (taxa < 0.45) fatores.push(`cumprimento 7d baixo (${Math.round(taxa * 100)}%)`);
  else if (taxa >= 0.75) fatores.push(`cumprimento 7d sólido (${Math.round(taxa * 100)}%)`);

  // Provas na semana (0–7+ → boost)
  const proofs = Math.max(0, input.proofsWeek);
  const proofBoost = Math.min(0.2, proofs * 0.035);
  score += proofBoost;
  if (proofs === 0) fatores.push("nenhuma prova esta semana");
  else if (proofs >= 5) fatores.push(`${proofs} provas esta semana`);

  // Check-ins de identidade
  const checks = input.checkinsIdentidade.filter(
    (c): c is "sim" | "parcial" | "nao" => c === "sim" || c === "parcial" || c === "nao",
  );
  if (checks.length > 0) {
    const points = checks.reduce((acc, c) => {
      if (c === "sim") return acc + 1;
      if (c === "parcial") return acc + 0.45;
      return acc;
    }, 0);
    const rate = points / checks.length;
    score += (rate - 0.5) * 0.35;
    const naoCount = checks.filter((c) => c === "nao").length;
    if (naoCount >= 2) {
      fatores.push(`${naoCount} check-ins "não" recentes`);
    } else if (rate >= 0.7) {
      fatores.push("check-ins de identidade alinhados");
    }
  } else {
    fatores.push("sem check-in de identidade recente");
    score -= 0.05;
  }

  // Skips no atributo do inimigo
  if (typeof input.enemySkipRate === "number" && Number.isFinite(input.enemySkipRate)) {
    const skip = clamp01(input.enemySkipRate);
    score -= skip * 0.25;
    if (skip >= 0.45) {
      const inimigo = input.inimigo?.trim() || "o inimigo";
      fatores.push(`falhas frequentes no eixo de ${inimigo} (${Math.round(skip * 100)}%)`);
    }
  }

  const identity_adherence = round4(clamp01(score));
  const risco_identidade = round4(clamp01(1 - identity_adherence));

  let principal_risco: string | null = null;
  if (risco_identidade >= 0.55) {
    principal_risco =
      fatores.find((f) => /não|nenhuma prova|baixo|falhas/i.test(f)) ??
      "negociar com o código sob pressão";
  } else if (risco_identidade >= 0.35) {
    principal_risco =
      fatores.find((f) => /moder|parcial|prova|check-in/i.test(f)) ??
      "oscilação de alinhamento";
  }

  return {
    identity_adherence,
    risco_identidade,
    principal_risco,
    fatores: fatores.slice(0, 5),
  };
}
