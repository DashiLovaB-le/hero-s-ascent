/**
 * Fixtures — progressão de níveis Charlie × Xadrez.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyChessGameResult,
  blunderChanceForChessLevel,
  defaultChessProgress,
  isSelectableChessLevel,
  searchDepthForChessLevel,
  selectableChessLevels,
  CHESS_WINS_TO_ADVANCE,
} from "./chess-progress";
import { pickCharlieMove } from "./chess-engine";

describe("chess progress", () => {
  it("só permite níveis ≤ desbloqueado", () => {
    assert.deepEqual(selectableChessLevels(3), [1, 2, 3]);
    assert.equal(isSelectableChessLevel(3, 2), true);
    assert.equal(isSelectableChessLevel(3, 4), false);
  });

  it("3 vitórias no nível atual sobem para o próximo", () => {
    let p = defaultChessProgress();
    for (let i = 0; i < CHESS_WINS_TO_ADVANCE - 1; i++) {
      const r = applyChessGameResult(p, { status: "won", difficultyLevel: 1 });
      assert.equal(r.leveledUp, false);
      assert.equal(r.level, 1);
      p = r;
    }
    const last = applyChessGameResult(p, { status: "won", difficultyLevel: 1 });
    assert.equal(last.leveledUp, true);
    assert.equal(last.level, 2);
    assert.equal(last.wins_at_level, 0);
  });

  it("vitória em nível abaixo não sobe o nível atual", () => {
    const p = { ...defaultChessProgress(), level: 3, wins_at_level: 2 };
    const r = applyChessGameResult(p, { status: "won", difficultyLevel: 2 });
    assert.equal(r.level, 3);
    assert.equal(r.wins_at_level, 2);
    assert.equal(r.wins_total, 1);
    assert.equal(r.leveledUp, false);
  });

  it("derrota e empate incrementam totais sem subir", () => {
    const p = defaultChessProgress();
    const lost = applyChessGameResult(p, { status: "lost", difficultyLevel: 1 });
    assert.equal(lost.losses_total, 1);
    assert.equal(lost.level, 1);
    const draw = applyChessGameResult(lost, { status: "draw", difficultyLevel: 1 });
    assert.equal(draw.draws_total, 1);
    assert.equal(draw.wins_at_level, 0);
  });

  it("profundidade sobe com o nível", () => {
    assert.equal(searchDepthForChessLevel(1), 0);
    assert.ok(searchDepthForChessLevel(10) >= searchDepthForChessLevel(5));
    assert.ok(blunderChanceForChessLevel(1) > blunderChanceForChessLevel(8));
  });
});

describe("chess engine by level", () => {
  it("retorna lance legal em níveis extremos", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    // Charlie joga de pretas — após e2e4
    const after = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const weak = pickCharlieMove(after, "b", 1);
    const strong = pickCharlieMove(after, "b", 10);
    assert.ok(weak);
    assert.ok(strong);
    void fen;
  });
});
