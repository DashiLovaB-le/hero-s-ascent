import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { habitTitlesConflict, parseMentorAiPayload } from "./context";

describe("parseMentorAiPayload habit_suggestion", () => {
  it("parses habit_suggestion and drops bare challenge when both present", () => {
    const payload = parseMentorAiPayload(
      JSON.stringify({
        message: "Comece a noite sem tela.",
        memory: null,
        memory_importance: 1,
        question: null,
        objective: null,
        challenge: {
          titulo: "Noite sem tela",
          descricao: "Todo dia sem celular depois das 22h",
          duracao_dias: 7,
          xp_recompensa: 200,
        },
        habit_suggestion: {
          titulo: "Noite sem tela",
          descricao: "Sem celular após 22h",
          xp_recompensa: 15,
          atributo: "disciplina",
          categoria: "mente",
        },
      }),
    );

    assert.equal(payload.habit_suggestion?.titulo, "Noite sem tela");
    assert.equal(payload.habit_suggestion?.xp_recompensa, 15);
    assert.equal(payload.habit_suggestion?.atributo, "disciplina");
    assert.equal(payload.habit_suggestion?.categoria, "mente");
    assert.equal(payload.challenge, null);
  });

  it("keeps challenge linked to existing habit and drops habit_suggestion", () => {
    const habitId = "11111111-1111-4111-8111-111111111111";
    const payload = parseMentorAiPayload(
      JSON.stringify({
        message: "Três treinos esta semana.",
        challenge: {
          titulo: "Sprint de treino",
          descricao: "Complete o hábito 3 vezes",
          duracao_dias: 7,
          xp_recompensa: 180,
          habit_id: habitId,
          completions_required: 3,
        },
        habit_suggestion: {
          titulo: "Treino",
          atributo: "forca",
          xp_recompensa: 20,
        },
      }),
    );

    assert.equal(payload.challenge?.habit_id, habitId);
    assert.equal(payload.habit_suggestion, null);
  });

  it("clamps habit xp to 5–50 and defaults atributo", () => {
    const payload = parseMentorAiPayload(
      JSON.stringify({
        message: "Ok.",
        habit_suggestion: {
          titulo: "Água ao acordar",
          xp_recompensa: 999,
          atributo: "nao-existe",
        },
      }),
    );
    assert.equal(payload.habit_suggestion?.xp_recompensa, 50);
    assert.equal(payload.habit_suggestion?.atributo, "disciplina");
  });
});

describe("habitTitlesConflict", () => {
  it("detects near duplicates", () => {
    assert.equal(habitTitlesConflict("Treino matinal", "treino matinal"), true);
    assert.equal(habitTitlesConflict("Ler 20 páginas", "Meditar"), false);
  });
});
