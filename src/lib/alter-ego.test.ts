import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatAlterEgoBlock,
  firstCodigoLine,
  synthesizeAlterEgoFallback,
} from "./alter-ego";

describe("synthesizeAlterEgoFallback", () => {
  it("builds a named identity from answers", () => {
    const ego = synthesizeAlterEgoFallback({
      virtude: "Disciplina",
      inimigo: "Procrastinação",
      reconhecimento: "homem que cumpre",
    });
    assert.equal(ego.nome, "O Disciplinado");
    assert.ok(ego.codigo.length >= 3);
    assert.match(ego.codigo.join(" "), /procrastinação/i);
    assert.ok(ego.virtudes.includes("Disciplina"));
  });
});

describe("formatAlterEgoBlock", () => {
  it("returns placeholder when missing", () => {
    const block = formatAlterEgoBlock(null);
    assert.match(block, /ainda não definida/i);
  });

  it("formats active alter ego for Charlie", () => {
    const block = formatAlterEgoBlock({
      nome: "O Executor",
      codigo: ["Eu faço o que prometi.", "Eu não negocio com a preguiça."],
      virtudes: ["Disciplina", "Foco"],
      inimigo: "Procrastinação",
      resumo: "Age mesmo sem vontade.",
    });
    assert.match(block, /IDENTIDADE DO HERÓI/);
    assert.match(block, /O Executor/);
    assert.match(block, /01\. Eu faço o que prometi/);
    assert.match(block, /guardião da identidade/i);
    assert.equal(firstCodigoLine({ codigo: ["Eu faço o que prometi."] }), "Eu faço o que prometi.");
  });
});
