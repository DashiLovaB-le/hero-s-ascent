import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeHybridExerciseXp } from "./exercise-xp";

describe("computeHybridExerciseXp", () => {
  it("aplica base + reps com fator de forma e teto", () => {
    const r = computeHybridExerciseXp({
      xpBase: 15,
      xpPorRepValida: 2,
      xpSessaoMax: 120,
      repsValidas: 50,
      formaPct: 100,
    });
    // (15 + 100) * 1 = 115
    assert.equal(r.xp, 115);
    assert.equal(r.breakdown.capped, false);
  });

  it("reduz XP com forma baixa e respeita cap", () => {
    const low = computeHybridExerciseXp({
      xpBase: 15,
      xpPorRepValida: 2,
      xpSessaoMax: 200,
      repsValidas: 20,
      formaPct: 0,
    });
    // (15+40)*0.5 = 27.5 → 28
    assert.equal(low.xp, 28);

    const capped = computeHybridExerciseXp({
      xpBase: 15,
      xpPorRepValida: 2,
      xpSessaoMax: 40,
      repsValidas: 100,
      formaPct: 100,
    });
    assert.equal(capped.xp, 40);
    assert.equal(capped.breakdown.capped, true);
  });

  it("zero reps → zero XP", () => {
    const r = computeHybridExerciseXp({
      xpBase: 15,
      xpPorRepValida: 2,
      xpSessaoMax: 120,
      repsValidas: 0,
      formaPct: 100,
    });
    assert.equal(r.xp, 0);
  });
});
