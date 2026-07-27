/**
 * Fixtures ML Fase 3 — guardrails adaptativos.
 * Run: npx tsx --test src/lib/ml/adaptive.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyChallengeGuardrails,
  decideChallengePolicy,
  decideReminders,
  ML_HIGH,
} from "./adaptive";

const low = {
  risco_streak: 0.1,
  risco_abandono: 0.1,
  weekday_weakest: null,
  weekday_weakest_label: null,
};

const highStreak = {
  risco_streak: 0.7,
  risco_abandono: 0.2,
  weekday_weakest: 5,
  weekday_weakest_label: "sexta",
};

describe("ML Fase 3 adaptive reminders", () => {
  it("pula habit_reminder com risco baixo e 1 pendente", () => {
    const d = decideReminders({
      scores: low,
      pending: 1,
      allDone: false,
      streakAtual: 3,
      ultimoDiaCompleto: "2026-07-26",
      hoje: "2026-07-27",
    });
    assert.equal(d.sendHabitReminder, false);
    assert.ok(d.reasons.includes("skip_habit_reminder_low_risk_one_pending"));
  });

  it("envia habit_reminder com vários pendentes mesmo em risco baixo", () => {
    const d = decideReminders({
      scores: low,
      pending: 3,
      allDone: false,
      streakAtual: 0,
      ultimoDiaCompleto: null,
      hoje: "2026-07-27",
    });
    assert.equal(d.sendHabitReminder, true);
  });

  it("escala streak_risk com risco alto e cita weekday", () => {
    const d = decideReminders({
      scores: highStreak,
      pending: 2,
      allDone: false,
      streakAtual: 5,
      ultimoDiaCompleto: "2026-07-26",
      hoje: "2026-07-27",
    });
    assert.equal(d.sendStreakRisk, true);
    assert.match(d.streakCorpo, /sexta/i);
    assert.ok(d.streakTitulo.toLowerCase().includes("alto") || d.metadataExtra.ml_guided);
    assert.ok(highStreak.risco_streak >= ML_HIGH);
  });
});

describe("ML Fase 3 adaptive challenges", () => {
  it("aplica tetos soft em risco alto", () => {
    const policy = decideChallengePolicy({
      scores: highStreak,
      activeChallengeCount: 0,
      challengesCreatedLast48h: 0,
    });
    assert.equal(policy.preferSoftChallenge, true);
    assert.equal(policy.maxXp, 120);
    assert.equal(policy.maxDuracaoDias, 2);

    const clamped = applyChallengeGuardrails(
      {
        titulo: "Maratona",
        descricao: "Faça tudo",
        duracao_dias: 10,
        xp_recompensa: 900,
        completions_required: 10,
      },
      policy,
    );
    assert.ok(clamped);
    assert.equal(clamped!.duracao_dias, 2);
    assert.equal(clamped!.xp_recompensa, 120);
    assert.equal(clamped!.completions_required, 2);
  });

  it("bloqueia novo desafio com cooldown 48h e ativo", () => {
    const policy = decideChallengePolicy({
      scores: highStreak,
      activeChallengeCount: 1,
      challengesCreatedLast48h: 1,
    });
    assert.equal(policy.allowNewChallenge, false);
    assert.equal(
      applyChallengeGuardrails(
        { titulo: "X", descricao: "Y", duracao_dias: 1, xp_recompensa: 50 },
        policy,
      ),
      null,
    );
  });
});
