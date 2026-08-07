/**
 * Fixtures — voz do Charlie nas notificações.
 * Run: npx tsx --test src/notifications/charlie-telegram-voice.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  intensityFromRisks,
  voiceCharlieNotification,
} from "./charlie-telegram-voice";

describe("charlie telegram voice", () => {
  it("habit_reminder militar é ordem, não alerta genérico", () => {
    const v = voiceCharlieNotification({
      tipo: "habit_reminder",
      personalitySlug: "militar",
      nome: "Lucas Silva",
      pending: 2,
      intensity: "high",
      fallbackTitulo: "Missões do dia em aberto",
      fallbackCorpo: "Ainda faltam 2 hábitos",
    });
    assert.match(v.titulo, /ordem|Ordem/i);
    assert.match(v.corpo, /Lucas/);
    assert.match(v.corpo, /2 hábitos/);
    assert.doesNotMatch(v.titulo, /Missões do dia/);
  });

  it("streak_risk estoico foca no controlável", () => {
    const v = voiceCharlieNotification({
      tipo: "streak_risk",
      personalitySlug: "estoico",
      streak: 12,
      weekdayWeak: "sexta",
      intensity: "high",
      fallbackTitulo: "Sua streak está em risco",
      fallbackCorpo: "Sequência de 12 dias",
    });
    assert.match(v.corpo, /12/);
    assert.match(v.corpo, /sexta/);
    assert.doesNotMatch(v.titulo, /Sua streak está em risco/);
  });

  it("fallback classico para slug desconhecido", () => {
    const v = voiceCharlieNotification({
      tipo: "habit_reminder",
      personalitySlug: "xyz-desconhecido",
      pending: 1,
      fallbackTitulo: "x",
      fallbackCorpo: "y",
    });
    assert.ok(v.titulo.length > 0);
    assert.match(v.corpo, /1 hábito/);
  });

  it("intensityFromRisks marca high", () => {
    assert.equal(intensityFromRisks(0.7, 0.2), "high");
    assert.equal(intensityFromRisks(0.1, 0.1), "soft");
  });

  it("mentor_challenge usa o título do desafio no corpo", () => {
    const v = voiceCharlieNotification({
      tipo: "mentor_challenge",
      personalitySlug: "classico",
      subject: "Treinar 20 min",
      fallbackTitulo: "Novo desafio do Charlie",
      fallbackCorpo: "Treinar 20 min",
    });
    assert.match(v.corpo, /Treinar 20 min/);
  });
});
