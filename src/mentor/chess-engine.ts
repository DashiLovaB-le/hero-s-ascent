import { Chess, type Color, type Move, type Square } from "chess.js";
import {
  blunderChanceForChessLevel,
  clampChessLevel,
  noiseForChessLevel,
  searchDepthForChessLevel,
} from "@/mentor/chess-progress";

const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

function evaluate(game: Chess, forColor: Color): number {
  if (game.isCheckmate()) {
    return game.turn() === forColor ? -100000 : 100000;
  }
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) {
    return 0;
  }

  let score = 0;
  const board = game.board();
  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue;
      const v = PIECE_VALUE[cell.type] ?? 0;
      score += cell.color === forColor ? v : -v;
    }
  }
  const center: Square[] = ["d4", "e4", "d5", "e5"];
  for (const sq of center) {
    const p = game.get(sq);
    if (!p) continue;
    score += p.color === forColor ? 8 : -8;
  }
  return score;
}

function minimax(
  game: Chess,
  depth: number,
  maximizing: boolean,
  forColor: Color,
  alpha: number,
  beta: number,
): number {
  if (depth <= 0 || game.isGameOver()) {
    return evaluate(game, forColor);
  }

  const moves = game.moves({ verbose: true });
  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      game.move(m);
      const val = minimax(game, depth - 1, false, forColor, alpha, beta);
      game.undo();
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const m of moves) {
    game.move(m);
    const val = minimax(game, depth - 1, true, forColor, alpha, beta);
    game.undo();
    best = Math.min(best, val);
    beta = Math.min(beta, val);
    if (beta <= alpha) break;
  }
  return best;
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/**
 * Lance do Charlie com dificuldade progressiva (nível 1–10).
 * Níveis baixos: mais ruído / blunders; altos: busca mais profunda.
 */
export function pickCharlieMove(
  fen: string,
  charlieColor: Color = "b",
  level = 5,
): Move | null {
  const game = new Chess(fen);
  if (game.isGameOver() || game.turn() !== charlieColor) return null;

  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;

  const L = clampChessLevel(level);
  const depth = searchDepthForChessLevel(L);
  const noise = noiseForChessLevel(L);
  const blunder = blunderChanceForChessLevel(L);

  shuffleInPlace(moves);

  if (blunder > 0 && Math.random() < blunder) {
    return moves[Math.floor(Math.random() * moves.length)]!;
  }

  let bestMove = moves[0]!;
  let bestScore = -Infinity;

  for (const m of moves) {
    game.move(m);
    const score =
      depth <= 0
        ? evaluate(game, charlieColor)
        : minimax(game, depth, false, charlieColor, -Infinity, Infinity);
    game.undo();
    const noisy = noise > 0 ? score + (Math.random() * noise * 2 - noise) : score;
    if (noisy > bestScore) {
      bestScore = noisy;
      bestMove = m;
    }
  }

  return bestMove;
}

export function outcomeFromGame(
  game: Chess,
  playerColor: Color,
): { status: "won" | "lost" | "draw"; reason: string } | null {
  if (!game.isGameOver()) return null;
  if (game.isCheckmate()) {
    const winner: Color = game.turn() === "w" ? "b" : "w";
    if (winner === playerColor) return { status: "won", reason: "checkmate" };
    return { status: "lost", reason: "checkmate" };
  }
  if (game.isStalemate()) return { status: "draw", reason: "stalemate" };
  if (game.isThreefoldRepetition()) return { status: "draw", reason: "threefold" };
  if (game.isInsufficientMaterial()) return { status: "draw", reason: "insufficient" };
  if (game.isDrawByFiftyMoves()) return { status: "draw", reason: "fifty" };
  return { status: "draw", reason: "draw" };
}
