import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAngleRepCounter } from "./angle-rep-counter";
import type { LandmarkPoint } from "./pose-math";

function pt(x: number, y: number, visibility = 1): LandmarkPoint {
  return { x, y, visibility };
}

function fakeLandmarks(): LandmarkPoint[] {
  return Array.from({ length: 33 }, () => pt(0.5, 0.5));
}

describe("createAngleRepCounter", () => {
  it("counts a valid down-up cycle", () => {
    let current = 170;
    const counter = createAngleRepCounter({
      config: {
        downEnterDeg: 130,
        upEnterDeg: 155,
        minDepthDeg: 100,
        lockoutDeg: 150,
        minAlignDeg: null,
        depthToAmplitude: () => 80,
      },
      read: () => ({ angle: current, align: current, side: "right" }),
    });

    const lms = fakeLandmarks();
    counter.update(lms);
    current = 90;
    counter.update(lms);
    current = 160;
    const snap = counter.update(lms);
    assert.equal(snap.repsValidas, 1);
    assert.equal(snap.lastRepValid, true);
  });
});
