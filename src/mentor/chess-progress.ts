/**
 * Progressão de dificuldade Charlie × Xadrez (puro, testável).
 * Níveis 1–10; 3 vitórias no nível atual desbloqueiam o próximo.
 * Vitórias em níveis abaixo do atual não contam para subir.
 */

export const CHESS_MIN_LEVEL = 1;
export const CHESS_MAX_LEVEL = 10;
export const CHESS_WINS_TO_ADVANCE = 3;

export type ChessProgress = {
  level: number;
  wins_at_level: number;
  wins_total: number;
  losses_total: number;
  draws_total: number;
};

export type ChessTerminalStatus = "won" | "lost" | "draw";

export function clampChessLevel(n: number): number {
  if (!Number.isFinite(n)) return CHESS_MIN_LEVEL;
  return Math.min(CHESS_MAX_LEVEL, Math.max(CHESS_MIN_LEVEL, Math.round(n)));
}

export function defaultChessProgress(): ChessProgress {
  return {
    level: CHESS_MIN_LEVEL,
    wins_at_level: 0,
    wins_total: 0,
    losses_total: 0,
    draws_total: 0,
  };
}

/** Níveis que o herói pode escolher manualmente (≤ desbloqueado). */
export function selectableChessLevels(unlockedLevel: number): number[] {
  const max = clampChessLevel(unlockedLevel);
  return Array.from({ length: max }, (_, i) => i + 1);
}

export function isSelectableChessLevel(unlockedLevel: number, chosen: number): boolean {
  const u = clampChessLevel(unlockedLevel);
  const c = clampChessLevel(chosen);
  return c >= CHESS_MIN_LEVEL && c <= u;
}

/**
 * Aplica resultado de uma partida.
 * - Totais W/D/L sempre atualizam.
 * - Progressão de nível só com vitória no nível atual (difficulty === level).
 */
export function applyChessGameResult(
  prev: ChessProgress,
  input: { status: ChessTerminalStatus; difficultyLevel: number },
): ChessProgress & { leveledUp: boolean; previousLevel: number } {
  const level = clampChessLevel(prev.level);
  const difficulty = clampChessLevel(input.difficultyLevel);
  let wins_at_level = Math.max(0, Math.min(CHESS_WINS_TO_ADVANCE, prev.wins_at_level));
  let wins_total = Math.max(0, prev.wins_total);
  let losses_total = Math.max(0, prev.losses_total);
  let draws_total = Math.max(0, prev.draws_total);
  let nextLevel = level;
  let leveledUp = false;

  if (input.status === "won") {
    wins_total += 1;
    if (difficulty === level && level < CHESS_MAX_LEVEL) {
      wins_at_level += 1;
      if (wins_at_level >= CHESS_WINS_TO_ADVANCE) {
        nextLevel = level + 1;
        wins_at_level = 0;
        leveledUp = true;
      }
    }
  } else if (input.status === "lost") {
    losses_total += 1;
  } else {
    draws_total += 1;
  }

  return {
    level: nextLevel,
    wins_at_level,
    wins_total,
    losses_total,
    draws_total,
    leveledUp,
    previousLevel: level,
  };
}

/** Profundidade do minimax (plies após o lance candidato). Cap 2 = jogável no device. */
export function searchDepthForChessLevel(level: number): number {
  const L = clampChessLevel(level);
  if (L <= 2) return 0;
  if (L <= 5) return 1;
  return 2;
}

/** Amplitude do ruído na avaliação (maior = mais fraco). */
export function noiseForChessLevel(level: number): number {
  const L = clampChessLevel(level);
  if (L <= 2) return 80;
  if (L <= 4) return 45;
  if (L <= 6) return 22;
  if (L <= 8) return 10;
  if (L === 9) return 4;
  return 0;
}

/** Chance 0–1 de escolher lance aleatório legal (nível baixo). */
export function blunderChanceForChessLevel(level: number): number {
  const L = clampChessLevel(level);
  if (L === 1) return 0.45;
  if (L === 2) return 0.28;
  if (L === 3) return 0.15;
  if (L === 4) return 0.08;
  return 0;
}

export function labelChessLevel(level: number): string {
  return `Nível ${clampChessLevel(level)}`;
}
