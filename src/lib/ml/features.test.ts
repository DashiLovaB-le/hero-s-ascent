/**
 * Fixtures ML Fase 1 — weekday fraco (sexta) eleva risco_streak.
 * Run: npx --yes tsx --test src/lib/ml/features.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeUserFeatures,
  scoreUserHeuristicV1,
  type HabitCompletionRow,
} from "./features";

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** asOf = quinta (UTC weekday 4) → amanhã = sexta (5). */
const AS_OF = "2026-07-23"; // Thursday
assert.equal(new Date(`${AS_OF}T12:00:00.000Z`).getUTCDay(), 4);

function buildStrongWeekCompletions(habitId: string): HabitCompletionRow[] {
  const out: HabitCompletionRow[] = [];
  // 21 dias: todos dias com hábito EXCETO sextas (weekday 5)
  for (let i = 0; i < 21; i++) {
    const dia = addDays(AS_OF, -20 + i);
    const wd = new Date(`${dia}T12:00:00.000Z`).getUTCDay();
    if (wd === 5) continue; // skip Fridays
    out.push({ habit_id: habitId, dia, xp_ganho: 10 });
  }
  return out;
}

describe("ML heuristic_v1", () => {
  it("marca sexta como weekday mais fraco", () => {
    const features = computeUserFeatures({
      asOfDate: AS_OF,
      habitCountAtivo: 1,
      completions: buildStrongWeekCompletions("h1"),
      challenges: [],
      streak_atual: 5,
      streak_maximo: 10,
      xp_total: 500,
      ultimo_dia_completo: AS_OF,
    });

    assert.equal(features.weekday_rates["5"]! < features.weekday_rates["1"]!, true);
    assert.ok(features.weekday_rates["5"]! < 0.45);
  });

  it("eleva risco_streak quando amanhã é o weekday fraco (sexta)", () => {
    const features = computeUserFeatures({
      asOfDate: AS_OF,
      habitCountAtivo: 1,
      completions: buildStrongWeekCompletions("h1"),
      challenges: [],
      streak_atual: 5,
      streak_maximo: 10,
      xp_total: 500,
      ultimo_dia_completo: AS_OF,
    });

    const scoresWeakTomorrow = scoreUserHeuristicV1(features, {
      asOfDate: AS_OF,
      tomorrowWeekday: 5, // sexta
    });
    const scoresStrongTomorrow = scoreUserHeuristicV1(features, {
      asOfDate: AS_OF,
      tomorrowWeekday: 2, // terça (forte)
    });

    assert.equal(scoresWeakTomorrow.weekday_weakest, 5);
    assert.equal(scoresWeakTomorrow.explicacao.weekday_weakest_label, "sexta");
    assert.ok(
      scoresWeakTomorrow.risco_streak > scoresStrongTomorrow.risco_streak,
      `esperado risco sexta (${scoresWeakTomorrow.risco_streak}) > terça (${scoresStrongTomorrow.risco_streak})`,
    );
    assert.ok(
      scoresWeakTomorrow.risco_streak >= 0.3,
      `risco sexta deveria ser relevante, got ${scoresWeakTomorrow.risco_streak}`,
    );
    assert.ok(
      scoresWeakTomorrow.explicacao.fatores_streak.some((f) => /sexta/i.test(f)),
    );
  });

  it("eleva risco_abandono com dias sem atividade", () => {
    const asOf = "2026-07-27";
    const features = computeUserFeatures({
      asOfDate: asOf,
      habitCountAtivo: 1,
      completions: [{ habit_id: "h1", dia: addDays(asOf, -10), xp_ganho: 10 }],
      challenges: [{ status: "expirado", ends_at: `${addDays(asOf, -2)}T12:00:00.000Z` }],
      streak_atual: 0,
      streak_maximo: 3,
      xp_total: 100,
      ultimo_dia_completo: addDays(asOf, -10),
    });

    const scores = scoreUserHeuristicV1(features, { asOfDate: asOf });
    assert.ok(scores.risco_abandono >= 0.4);
    assert.ok(features.dias_sem_habito >= 5);
  });
});
