/**
 * Fixtures ML Fase 3 — aderência à identidade.
 * Run via: npm run test:ml
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapInimigoToAtributo,
  scoreIdentityAdherence,
} from "./identity-adherence";
import { formatMlSignalsForMentor, scoreUserHeuristicV1 } from "./features";
import type { UserFeaturesV1 } from "./features";

describe("identity adherence", () => {
  it("sem alter ego retorna aderência e risco 0", () => {
    const r = scoreIdentityAdherence({
      hasAlterEgo: false,
      proofsWeek: 5,
      checkinsIdentidade: ["sim", "sim"],
      taxaConclusao7: 1,
    });
    assert.equal(r.identity_adherence, 0);
    assert.equal(r.risco_identidade, 0);
    assert.equal(r.principal_risco, null);
  });

  it("baixa conclusão + sem provas eleva risco", () => {
    const r = scoreIdentityAdherence({
      hasAlterEgo: true,
      proofsWeek: 0,
      checkinsIdentidade: ["nao", "nao"],
      taxaConclusao7: 0.2,
      enemySkipRate: 0.6,
      inimigo: "Procrastinação",
    });
    assert.ok(r.risco_identidade >= 0.55);
    assert.ok(r.identity_adherence < 0.5);
    assert.ok(r.principal_risco);
  });

  it("cumprimento sólido + provas + check-ins sim eleva aderência", () => {
    const r = scoreIdentityAdherence({
      hasAlterEgo: true,
      proofsWeek: 6,
      checkinsIdentidade: ["sim", "sim", "sim"],
      taxaConclusao7: 0.9,
      enemySkipRate: 0.1,
      inimigo: "Procrastinação",
    });
    assert.ok(r.identity_adherence >= 0.7);
    assert.ok(r.risco_identidade <= 0.3);
  });

  it("mapInimigoToAtributo reconhece procrastinação → disciplina", () => {
    assert.equal(mapInimigoToAtributo("Procrastinação"), "disciplina");
    assert.equal(mapInimigoToAtributo("medo"), "espirito");
  });
});

describe("formatMlSignals identity", () => {
  it("inclui Aderência recente e Principal risco quando há identidade", () => {
    const base: UserFeaturesV1 = {
      features_version: "v1",
      dias_ativos_7: 5,
      dias_ativos_21: 12,
      dias_sem_habito: 0,
      media_habitos_dia_7: 1,
      media_habitos_dia_21: 1,
      taxa_conclusao_7: 0.25,
      taxa_conclusao_21: 0.4,
      weekday_rates: { "0": 0.5, "1": 0.5, "2": 0.5, "3": 0.5, "4": 0.5, "5": 0.2, "6": 0.5 },
      streak_atual: 2,
      streak_maximo: 5,
      xp_total: 200,
      nivel: 2,
      desafios_ativos: 0,
      desafios_concluidos_21: 0,
      desafios_expirados_21: 0,
      ultimo_dia_completo: "2026-07-23",
      dias_desde_ultima_atividade: 0,
      media_xp_dia_21: 10,
    };
    const scores = scoreUserHeuristicV1(base, {
      asOfDate: "2026-07-23",
      identity: {
        hasAlterEgo: true,
        proofsWeek: 0,
        checkinsIdentidade: ["nao", "nao"],
        taxaConclusao7: 0.25,
        enemySkipRate: 0.7,
        inimigo: "Procrastinação",
      },
    });
    const block = formatMlSignalsForMentor(scores);
    assert.match(block, /Aderência recente/);
    assert.match(block, /risco_identidade=/);
    assert.ok(scores.risco_identidade > 0);
  });
});
