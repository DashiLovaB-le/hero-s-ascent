/**
 * Contador de hold (prancha): acumula tempo com alinhamento estável.
 */

import {
  clamp01,
  jointAngle,
  LM,
  pickArmSide,
  type ExerciseCounterSnapshot,
  type ExerciseFeedbackCode,
  type LandmarkPoint,
} from "./pose-math";

export type HoldCounterConfig = {
  /** Ângulo ombro–quadril–tornozelo mínimo para “linha” */
  minAlignDeg: number;
  /** ms contínuos bons antes de contar como hold ativo */
  settleMs: number;
};

const DEFAULT_HOLD: HoldCounterConfig = {
  minAlignDeg: 150,
  settleMs: 400,
};

export function createHoldCounter(config: HoldCounterConfig = DEFAULT_HOLD) {
  let cfg = { ...config };
  let holdMs = 0;
  let goodSince: number | null = null;
  let breaks = 0;
  let lastNow = 0;
  let feedback: ExerciseFeedbackCode = "need_pose";
  let align: number | null = null;
  let side: "left" | "right" | null = null;
  let formSamples = 0;
  let formHits = 0;

  function snapshot(): ExerciseCounterSnapshot {
    const secs = Math.floor(holdMs / 1000);
    return {
      phase: "hold",
      /** Segundos válidos de hold → “reps” para XP/API existente */
      repsValidas: secs,
      repsInvalidas: breaks,
      amplitudeMedia: secs > 0 ? Math.min(100, Math.round((holdMs / 1000 / 30) * 100)) : 0,
      formaPct: formSamples > 0 ? Math.round((formHits / formSamples) * 100) : 100,
      elbowAngle: align,
      bodyAlignAngle: align,
      feedback,
      lastRepValid: null,
      depthProgress: clamp01(holdMs / 30_000),
      lockoutProgress: align != null ? clamp01((align - 120) / 60) : 0,
      side,
      holdMs,
    };
  }

  function reset() {
    holdMs = 0;
    goodSince = null;
    breaks = 0;
    lastNow = 0;
    feedback = "need_pose";
    align = null;
    side = null;
    formSamples = 0;
    formHits = 0;
    return snapshot();
  }

  function update(
    landmarks: LandmarkPoint[] | null | undefined,
    nowMs: number,
  ): ExerciseCounterSnapshot {
    if (!landmarks || landmarks.length < 29) {
      feedback = "need_pose";
      goodSince = null;
      return snapshot();
    }

    side = pickArmSide(landmarks);
    if (!side) {
      feedback = "need_pose";
      goodSince = null;
      return snapshot();
    }

    const sh = side === "left" ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
    const hip = side === "left" ? LM.LEFT_HIP : LM.RIGHT_HIP;
    const ankle = side === "left" ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;
    align = jointAngle(landmarks, sh, hip, ankle, 0.25);

    if (align == null) {
      feedback = "need_pose";
      goodSince = null;
      return snapshot();
    }

    formSamples += 1;
    const ok = align >= cfg.minAlignDeg;
    if (ok) formHits += 1;

    const dt = lastNow > 0 ? Math.min(100, Math.max(0, nowMs - lastNow)) : 0;
    lastNow = nowMs;

    if (ok) {
      if (goodSince == null) goodSince = nowMs;
      if (nowMs - goodSince >= cfg.settleMs) {
        holdMs += dt;
        feedback = "hold";
      } else {
        feedback = "lockout";
      }
    } else {
      if (goodSince != null && holdMs > 500) breaks += 1;
      goodSince = null;
      feedback = "hold_break";
    }

    return snapshot();
  }

  return { update, reset, snapshot, setConfig: (n: Partial<HoldCounterConfig>) => { cfg = { ...cfg, ...n }; } };
}

export type HoldCounter = ReturnType<typeof createHoldCounter>;
