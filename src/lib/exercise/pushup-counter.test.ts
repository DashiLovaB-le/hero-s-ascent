import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  angleAtDeg,
  createPushupCounter,
  depthToAmplitude,
  type LandmarkPoint,
} from "./pushup-counter";
import { evaluateFraming, DEFAULT_GUIDE } from "./pushup-framing";
import { configFromCalibration, createCalibrator } from "./pushup-calibration";
import { createPushupSession } from "./pushup-session";

function pt(x: number, y: number, visibility = 1): LandmarkPoint {
  return { x, y, visibility };
}

/** Corpo bem enquadrado na guia, lado direito dominante. */
function wellFramedBody(elbowDeg: number, bodyAlignDeg = 170): LandmarkPoint[] {
  const landmarks: LandmarkPoint[] = Array.from({ length: 33 }, () => pt(0, 0, 0));
  const midX = 0.5;
  const shoulderY = 0.28;
  const elbowY = 0.42;
  const wristY = 0.55;
  const hipY = 0.58;
  const ankleY = 0.78;

  const turn = ((180 - elbowDeg) * Math.PI) / 180;
  const fromShoulder = { x: 0, y: 1 };
  const dir = {
    x: fromShoulder.x * Math.cos(turn) - fromShoulder.y * Math.sin(turn),
    y: fromShoulder.x * Math.sin(turn) + fromShoulder.y * Math.cos(turn),
  };

  const rShoulder = pt(midX + 0.1, shoulderY, 1);
  const rElbow = pt(midX + 0.1, elbowY, 1);
  const rWrist = pt(rElbow.x + dir.x * 0.12, rElbow.y + dir.y * 0.12, 1);
  const rHip = pt(midX + 0.08, hipY, 1);
  const alignRad = ((180 - bodyAlignDeg) * Math.PI) / 180;
  const rAnkle = pt(rHip.x + Math.sin(alignRad) * 0.04, rHip.y + Math.cos(alignRad) * 0.2, 1);

  landmarks[11] = pt(midX - 0.1, shoulderY, 1);
  landmarks[12] = rShoulder;
  landmarks[13] = pt(midX - 0.1, elbowY, 0.9);
  landmarks[14] = rElbow;
  landmarks[15] = pt(midX - 0.1, wristY, 0.85);
  landmarks[16] = rWrist;
  landmarks[23] = pt(midX - 0.08, hipY, 0.9);
  landmarks[24] = rHip;
  landmarks[27] = pt(midX - 0.08, ankleY, 0.7);
  landmarks[28] = rAnkle;
  return landmarks;
}

function frameForElbow(elbowDeg: number, bodyAlignDeg = 170): LandmarkPoint[] {
  const landmarks: LandmarkPoint[] = Array.from({ length: 33 }, () => pt(0, 0, 0));
  const elbow = pt(0.5, 0.5, 1);
  const shoulder = pt(0.5, 0.35, 1);
  const fromShoulder = { x: 0, y: 1 };
  const turn = ((180 - elbowDeg) * Math.PI) / 180;
  const dir = {
    x: fromShoulder.x * Math.cos(turn) - fromShoulder.y * Math.sin(turn),
    y: fromShoulder.x * Math.sin(turn) + fromShoulder.y * Math.cos(turn),
  };
  const wrist = pt(elbow.x + dir.x * 0.15, elbow.y + dir.y * 0.15, 1);
  const hip = pt(0.5, 0.68, 1);
  const alignRad = ((180 - bodyAlignDeg) * Math.PI) / 180;
  const ankle = pt(hip.x + Math.sin(alignRad) * 0.05, hip.y + Math.cos(alignRad) * 0.22, 1);

  landmarks[12] = shoulder;
  landmarks[14] = elbow;
  landmarks[16] = wrist;
  landmarks[24] = hip;
  landmarks[28] = ankle;
  landmarks[11] = pt(0.2, 0.35, 0.05);
  landmarks[13] = pt(0.2, 0.5, 0.05);
  landmarks[15] = pt(0.2, 0.65, 0.05);
  return landmarks;
}

describe("pushup-counter math", () => {
  it("calcula ângulo no vértice", () => {
    assert.ok(Math.abs(angleAtDeg(pt(0, 0), pt(0, 1), pt(1, 1)) - 90) < 1);
  });

  it("mapeia profundidade para amplitude", () => {
    assert.ok(depthToAmplitude(60) > depthToAmplitude(110));
  });
});

describe("createPushupCounter", () => {
  it("conta rep válida up→down→up com profundidade", () => {
    const c = createPushupCounter();
    let s = c.update(frameForElbow(170));
    assert.equal(s.phase, "up");
    s = c.update(frameForElbow(80));
    assert.equal(s.phase, "down");
    s = c.update(frameForElbow(165));
    assert.equal(s.repsValidas, 1);
    assert.equal(s.repsInvalidas, 0);
    assert.equal(s.lastRepValid, true);
  });

  it("marca inválida se não desceu o bastante", () => {
    const c = createPushupCounter();
    c.update(frameForElbow(170));
    c.update(frameForElbow(110));
    const after = c.update(frameForElbow(165));
    assert.equal(after.repsValidas, 0);
    assert.equal(after.repsInvalidas, 1);
    assert.equal(after.lastRepValid, false);
  });

  it("pede alinhamento quando o corpo está torto", () => {
    const c = createPushupCounter();
    const s = c.update(frameForElbow(170, 100));
    assert.equal(s.feedback, "align_body");
  });
});

describe("evaluateFraming", () => {
  it("aceita corpo bem centrado na guia", () => {
    const r = evaluateFraming(wellFramedBody(165), DEFAULT_GUIDE);
    assert.equal(r.ok, true);
    assert.ok(r.coverage >= 0.7);
  });

  it("rejeita sem pose", () => {
    const r = evaluateFraming(null);
    assert.equal(r.ok, false);
    assert.ok(r.issues.includes("no_pose"));
  });
});

describe("configFromCalibration", () => {
  it("mantém invariantes downEnter > minDepth e upEnter >= lockout", () => {
    for (const lock of [150, 160, 170, 175]) {
      const cfg = configFromCalibration(lock, 165);
      assert.ok(cfg.downEnterDeg > cfg.minDepthDeg, `lock=${lock}`);
      assert.ok(cfg.upEnterDeg >= cfg.lockoutDeg, `lock=${lock}`);
      assert.ok(cfg.upEnterDeg - cfg.downEnterDeg >= 20, `lock=${lock}`);
    }
  });
});

describe("createCalibrator", () => {
  it("completa após hold estável", () => {
    const cal = createCalibrator({
      holdMs: 500,
      maxElbowJitterDeg: 8,
      minLockoutDeg: 140,
      sampleEveryMs: 50,
    });
    let s = cal.reset();
    let t = 1000;
    for (let i = 0; i < 20; i++) {
      t += 60;
      s = cal.update(t, true, 168, 170);
    }
    assert.equal(s.ready, true);
    assert.ok(s.meanLockout != null && s.meanLockout > 160);
  });

  it("reinicia se houver jitter", () => {
    const cal = createCalibrator({
      holdMs: 800,
      maxElbowJitterDeg: 5,
      minLockoutDeg: 140,
      sampleEveryMs: 50,
    });
    cal.reset();
    let t = 0;
    cal.update((t += 60), true, 168, 170);
    cal.update((t += 60), true, 168, 170);
    const mid = cal.update((t += 60), true, 150, 170); // jump
    assert.ok(mid.progress < 0.5);
    assert.equal(mid.ready, false);
  });
});

describe("createPushupSession", () => {
  it("flui framing → calibrating → tracking e conta reps", () => {
    const session = createPushupSession();
    let t = 0;
    let snap = session.update(wellFramedBody(168), (t += 100));
    assert.equal(snap.stage, "framing");

    // histerese 400ms
    snap = session.update(wellFramedBody(168), (t += 450));
    assert.equal(snap.stage, "calibrating");

    // calibração ~2.8s
    for (let i = 0; i < 60; i++) {
      snap = session.update(wellFramedBody(168), (t += 80));
      if (snap.stage === "tracking") break;
    }
    assert.equal(snap.stage, "tracking");

    snap = session.update(wellFramedBody(168), (t += 50));
    snap = session.update(wellFramedBody(75), (t += 50));
    snap = session.update(wellFramedBody(165), (t += 50));
    assert.ok(snap.counter.repsValidas + snap.counter.repsInvalidas >= 1);
  });

  it("recalibrar volta ao framing", () => {
    const session = createPushupSession();
    let t = 0;
    session.update(wellFramedBody(168), (t += 500));
    for (let i = 0; i < 50; i++) {
      session.update(wellFramedBody(168), (t += 80));
    }
    const after = session.recalibrate();
    assert.equal(after.stage, "framing");
    assert.equal(after.counter.repsValidas, 0);
  });
});
