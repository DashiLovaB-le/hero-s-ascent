/**
 * Fixtures ML Fase 4 — agente + CF.
 * Run via: npm run test:ml
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideAgentInitiative } from "./agent";
import { computeCfRecommendations } from "./collaborative";

describe("ML Fase 4 agent", () => {
  it("não cria em quiet hours", () => {
    const d = decideAgentInitiative({
      scores: {
        risco_streak: 0.9,
        risco_abandono: 0.1,
        weekday_weakest: 5,
        weekday_weakest_label: "sexta",
      },
      hasCheckinToday: false,
      hasPendingInitiative: false,
      alreadyNotifiedToday: false,
      quietHours: true,
      cfSuggestion: null,
    });
    assert.equal(d.create, false);
  });

  it("prioriza streak_protect em risco alto", () => {
    const d = decideAgentInitiative({
      scores: {
        risco_streak: 0.7,
        risco_abandono: 0.2,
        weekday_weakest: 5,
        weekday_weakest_label: "sexta",
      },
      hasCheckinToday: true,
      hasPendingInitiative: false,
      alreadyNotifiedToday: false,
      quietHours: false,
      cfSuggestion: null,
    });
    assert.equal(d.create, true);
    assert.equal(d.kind, "streak_protect");
    assert.match(d.corpo, /sexta/i);
  });

  it("pede check-in quando ausente e risco moderado", () => {
    const d = decideAgentInitiative({
      scores: {
        risco_streak: 0.4,
        risco_abandono: 0.4,
        weekday_weakest: null,
        weekday_weakest_label: null,
      },
      hasCheckinToday: false,
      hasPendingInitiative: false,
      alreadyNotifiedToday: false,
      quietHours: false,
      cfSuggestion: null,
      hourLocalApprox: 21,
    });
    assert.equal(d.kind, "checkin_nudge");
  });
});

describe("ML Fase 4 CF", () => {
  it("não sugere com N baixo", () => {
    const map = computeCfRecommendations([
      { user_id: "a", weekday_rates: { "0": 1, "1": 1 }, habit_titles: ["Treino"] },
      { user_id: "b", weekday_rates: { "0": 1, "1": 0.9 }, habit_titles: ["Leitura"] },
    ]);
    assert.equal(map.get("a")!.suggestions.length, 0);
  });

  it("sugere hábito de peers similares", () => {
    const ratesStrong = {
      "0": 0.9,
      "1": 0.9,
      "2": 0.9,
      "3": 0.9,
      "4": 0.9,
      "5": 0.2,
      "6": 0.8,
    };
    const users = Array.from({ length: 8 }, (_, i) => ({
      user_id: `u${i}`,
      weekday_rates: ratesStrong,
      habit_titles: i === 0 ? ["Treino"] : ["Treino", "Meditação"],
    }));
    const map = computeCfRecommendations(users, { minPeers: 5 });
    const rec = map.get("u0")!;
    assert.ok(rec.peer_count >= 5);
    assert.ok(rec.suggestions.some((s) => /medita/i.test(s.titulo)));
  });
});
