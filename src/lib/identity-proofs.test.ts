import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatIdentityProofsForMentor,
  identityArcForChapter,
} from "./identity-proofs";

describe("identityArcForChapter", () => {
  it("maps chapter 1 to Intenção and 7 to Maestria", () => {
    assert.equal(identityArcForChapter(1).nome, "Intenção");
    assert.equal(identityArcForChapter(7).nome, "Maestria");
    assert.equal(identityArcForChapter(99).nome, "Maestria");
  });
});

describe("formatIdentityProofsForMentor", () => {
  it("includes week/total and evening guidance", () => {
    const block = formatIdentityProofsForMentor({
      alterEgoNome: "O Executor",
      stats: { week: 4, total: 12 },
      recentLabels: ["Cumpriu o hábito: Treinar"],
      identidadeHoje: "parcial",
    });
    assert.match(block, /PROVAS DE IDENTIDADE/);
    assert.match(block, /O Executor/);
    assert.match(block, /Provas esta semana: 4/);
    assert.match(block, /parcial/);
    assert.match(block, /RELATÓRIO|fechamento|evening/i);
  });
});
