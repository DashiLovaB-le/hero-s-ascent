import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeChessForMentor } from "./chess-context";

describe("summarizeChessForMentor", () => {
  it("returns null when there are no finished games", () => {
    assert.equal(summarizeChessForMentor([]).line, null);
    assert.equal(
      summarizeChessForMentor([
        {
          status: "active",
          result_reason: null,
          updated_at: new Date().toISOString(),
        },
      ]).line,
      null,
    );
  });

  it("builds a compact ritual line for recent results", () => {
    const now = Date.now();
    const line = summarizeChessForMentor(
      [
        {
          status: "won",
          result_reason: "checkmate",
          updated_at: new Date(now - 2 * 3600_000).toISOString(),
        },
        {
          status: "lost",
          result_reason: "checkmate",
          updated_at: new Date(now - 2 * 86_400_000).toISOString(),
        },
        {
          status: "draw",
          result_reason: "abandoned",
          updated_at: new Date(now - 3 * 86_400_000).toISOString(),
        },
      ],
      { timezone: "America/Sao_Paulo" },
    ).line;

    assert.ok(line);
    assert.match(line, /Xadrez \(ritual/);
    assert.match(line, /última = vitória/);
    assert.match(line, /sequência recente V-D-A/);
    assert.match(line, /não invente lances nem Elo/);
  });
});
