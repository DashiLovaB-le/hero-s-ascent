import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assembleMentorGoals, formatMentorGoalsBlock } from "@/lib/mentor-goals";
import { buildMentorContextBlock } from "@/mentor/context";

const attrs = {
  forca: 3,
  disciplina: 5,
  sabedoria: 2,
  espirito: 2,
  testosterona: 2,
  prosperidade: 2,
  conhecimento: 2,
  lideranca: 2,
};

describe("assembleMentorGoals / formatMentorGoalsBlock", () => {
  it("monta progresso e hábitos ligados", () => {
    const items = assembleMentorGoals({
      hoje: "2026-08-02",
      goals: [
        {
          id: "g1",
          titulo: "Treinar 4x",
          categoria: "corpo",
          status: "ativa",
          is_norte: true,
          motivo: "Saúde e disciplina",
          prazo: "2026-08-01",
          completed_at: null,
        },
      ],
      habits: [
        {
          id: "h1",
          titulo: "Flexão",
          categoria: "corpo",
          goal_id: "g1",
          ativo: true,
        },
      ],
      completions7d: [
        { habit_id: "h1", dia: "2026-08-01" },
        { habit_id: "h1", dia: "2026-08-02" },
      ],
    });
    assert.equal(items.length, 1);
    assert.equal(items[0].is_norte, true);
    assert.equal(items[0].overdue, true);
    assert.equal(items[0].linkedHabits.length, 1);
    assert.equal(items[0].progressSource, "linked");
    assert.ok(items[0].progressPct > 0);

    const block = formatMentorGoalsBlock(items);
    assert.match(block, /METAS DO HERÓI/);
    assert.match(block, /Treinar 4x/);
    assert.match(block, /NORTE/);
    assert.match(block, /ATRASADO|atrasado|prazo/i);
    assert.match(block, /Flexão/);
    assert.match(block, /METAS — REGRAS/);
  });

  it("empty state com regras", () => {
    const block = formatMentorGoalsBlock([]);
    assert.match(block, /nenhuma/);
    assert.match(block, /METAS — REGRAS/);
  });
});

describe("buildMentorContextBlock inclui metas enriquecidas", () => {
  it("injeta bloco METAS DO HERÓI", () => {
    const text = buildMentorContextBlock({
      nome: "Dashi",
      xp_total: 100,
      streak_atual: 2,
      streak_maximo: 5,
      capitulo_atual: 1,
      ultimo_dia_completo: null,
      created_at: "2026-07-01T00:00:00.000Z",
      attributes: attrs,
      habits: [{ id: "h1", titulo: "Ler", atributo: "conhecimento" }],
      goals: [
        {
          titulo: "Ler 12 livros",
          categoria: "mente",
          status: "ativa",
          is_norte: true,
          motivo: "Clareza mental",
          prazo: null,
          overdue: false,
          progressPct: 28,
          progressSource: "linked",
          linkedHabits: [
            { titulo: "Ler", doneToday: true, completions7d: 2 },
          ],
        },
      ],
      completionsLast21: [],
      completedTodayIds: ["h1"],
      memories: [],
      activeChallenges: [],
      daysSinceLastVisit: 0,
      objective: { titulo: "Consistência", motivo: null },
      pendingQuestionToday: false,
      allowQuestion: true,
      pendingHabitSuggestion: false,
      allowHabitSuggestion: true,
      weather: null,
    });
    assert.match(text, /METAS DO HERÓI/);
    assert.match(text, /Ler 12 livros/);
    assert.match(text, /Clareza mental/);
    assert.match(text, /ritmo7d 28%/);
    assert.doesNotMatch(text, /^Metas ativas:/m);
  });
});
