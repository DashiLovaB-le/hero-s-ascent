/**
 * Fixtures — relatório evening de identidade.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildIdentityEveningReport } from "./identity-evening-report";

describe("buildIdentityEveningReport", () => {
  it("resume compromissos, provas e código", () => {
    const r = buildIdentityEveningReport({
      firstName: "Lucas",
      alterEgoNome: "O Executor",
      codigoLine: "Faço o difícil primeiro",
      habitsDone: 2,
      habitsTotal: 3,
      proofsWeek: 4,
      identidadeHoje: "parcial",
      aderenciaPct: 62,
    });
    assert.match(r.titulo, /Executor/);
    assert.match(r.corpo, /2\/3/);
    assert.match(r.corpo, /4 provas/);
    assert.match(r.corpo, /Faço o difícil primeiro/);
    assert.match(r.corpo, /não apaga|não destrói|ainda dá/i);
  });

  it("celebra dia fechado sem pressão", () => {
    const r = buildIdentityEveningReport({
      habitsDone: 2,
      habitsTotal: 2,
      proofsWeek: 1,
    });
    assert.match(r.corpo, /dia fechado|paz/i);
    assert.match(r.corpo, /1 prova/);
  });
});
