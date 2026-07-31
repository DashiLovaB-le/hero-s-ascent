import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { challengeFollowUpUserText, resolveMentorCyclePhase } from "./context";

describe("resolveMentorCyclePhase", () => {
  it("prioriza hint explícito", () => {
    assert.match(
      resolveMentorCyclePhase({
        activeChallengeCount: 2,
        allowQuestion: true,
        cyclePhaseHint: "Verificar/Aprender (desafio concluído)",
      }),
      /Verificar\/Aprender/,
    );
  });

  it("com desafio ativo → Executar/Verificar", () => {
    assert.match(
      resolveMentorCyclePhase({ activeChallengeCount: 1, allowQuestion: true }),
      /Executar\/Verificar/,
    );
  });

  it("sem desafio e com pergunta → Observar/Pensar", () => {
    assert.match(
      resolveMentorCyclePhase({ activeChallengeCount: 0, allowQuestion: true }),
      /Observar\/Pensar/,
    );
  });

  it("sem desafio e sem pergunta → Planejar/Executar", () => {
    assert.match(
      resolveMentorCyclePhase({ activeChallengeCount: 0, allowQuestion: false }),
      /Planejar\/Executar/,
    );
  });
});

describe("challengeFollowUpUserText", () => {
  it("complete pede memory e bloqueia novo desafio", () => {
    const { userText, cyclePhaseHint } = challengeFollowUpUserText("Alba", "complete", true);
    assert.match(cyclePhaseHint, /Verificar\/Aprender/);
    assert.match(userText, /CONCLUIU/);
    assert.match(userText, /Não proponha novo desafio/);
    assert.match(userText, /pergunta estruturada/);
  });

  it("decline sem pergunta quando allowQuestion=false", () => {
    const { userText } = challengeFollowUpUserText("Alba", "decline", false);
    assert.match(userText, /RECUSOU/);
    assert.match(userText, /question = null/);
  });

  it("expire cobre plano não fechado", () => {
    const { userText } = challengeFollowUpUserText("Alba", "expire", true);
    assert.match(userText, /EXPIROU/);
    assert.match(userText, /não fechou/i);
  });
});
