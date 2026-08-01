/**
 * Exercícios validados — XP híbrido e regras de sessão (MVP flexão).
 */

export const EXERCISE_CONSENT_VERSION = "v1";

export type HybridXpInput = {
  xpBase: number;
  xpPorRepValida: number;
  xpSessaoMax: number;
  repsValidas: number;
  /** 0–100; se ausente, assume 100 */
  formaPct?: number | null;
};

export function computeHybridExerciseXp(input: HybridXpInput): {
  xp: number;
  breakdown: {
    base: number;
    reps: number;
    formaFactor: number;
    beforeCap: number;
    capped: boolean;
  };
} {
  const reps = Math.max(0, Math.floor(input.repsValidas));
  const forma =
    input.formaPct == null || Number.isNaN(Number(input.formaPct))
      ? 100
      : Math.min(100, Math.max(0, Number(input.formaPct)));
  // Fator de forma: 0.5–1.0 (nunca zera a sessão se houve reps)
  const formaFactor = reps === 0 ? 0 : 0.5 + (forma / 100) * 0.5;
  const base = Math.max(0, input.xpBase);
  const repsXp = Math.max(0, input.xpPorRepValida) * reps;
  const beforeCap = Math.round((base + repsXp) * formaFactor);
  const xp = Math.min(Math.max(0, input.xpSessaoMax), beforeCap);
  return {
    xp,
    breakdown: {
      base,
      reps: repsXp,
      formaFactor: Number(formaFactor.toFixed(3)),
      beforeCap,
      capped: beforeCap > input.xpSessaoMax,
    },
  };
}

export const PUSHUP_SLUG = "pushup" as const;
