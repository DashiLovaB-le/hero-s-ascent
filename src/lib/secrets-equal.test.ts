import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { secretsEqual } from "@/lib/secrets-equal";

describe("secretsEqual", () => {
  it("aceita strings iguais", () => {
    assert.equal(secretsEqual("cron-secret-1", "cron-secret-1"), true);
  });

  it("rejeita strings diferentes do mesmo tamanho", () => {
    assert.equal(secretsEqual("cron-secret-1", "cron-secret-2"), false);
  });

  it("rejeita tamanhos diferentes e vazios", () => {
    assert.equal(secretsEqual("abc", "ab"), false);
    assert.equal(secretsEqual("", "x"), false);
    assert.equal(secretsEqual("x", ""), false);
    assert.equal(secretsEqual("", ""), false);
  });
});
