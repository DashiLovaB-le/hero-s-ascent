/**
 * Contador genérico por ângulo (agachamento, afundo, sit-up, glute bridge…).
 * Convenção: ângulo ALTO = posição "up"/lockout; ângulo BAIXO = "down"/profundidade.
 */

import {
  clamp01,
  type ExerciseCounterSnapshot,
  type ExerciseFeedbackCode,
  type ExercisePhase,
  type LandmarkPoint,
} from "./pose-math";

export type AngleRepConfig = {
  downEnterDeg: number;
  upEnterDeg: number;
  minDepthDeg: number;
  lockoutDeg: number;
  /** Se null, não valida alinhamento. */
  minAlignDeg: number | null;
  /** Converte profundidade (ângulo mín) → amplitude 0–100 */
  depthToAmplitude: (minDeg: number) => number;
};

export type AngleReader = (
  landmarks: LandmarkPoint[],
) => {
  angle: number | null;
  align: number | null;
  side: "left" | "right" | null;
};

export function createAngleRepCounter(opts: {
  config: AngleRepConfig;
  read: AngleReader;
}) {
  let cfg = { ...opts.config };
  let phase: ExercisePhase = "unknown";
  let repsValidas = 0;
  let repsInvalidas = 0;
  let formHits = 0;
  let formTotal = 0;
  let amplitudeSum = 0;
  let amplitudeCount = 0;
  let minInRep: number | null = null;
  let formOkInRep = true;
  let lastRepValid: boolean | null = null;
  let feedback: ExerciseFeedbackCode = "need_pose";
  let angle: number | null = null;
  let align: number | null = null;
  let side: "left" | "right" | null = null;
  let depthProgress = 0;
  let lockoutProgress = 0;

  function snapshot(): ExerciseCounterSnapshot {
    return {
      phase,
      repsValidas,
      repsInvalidas,
      amplitudeMedia:
        amplitudeCount > 0 ? Math.round(amplitudeSum / amplitudeCount) : 0,
      formaPct: formTotal > 0 ? Math.round((formHits / formTotal) * 100) : 100,
      elbowAngle: angle,
      bodyAlignAngle: align,
      feedback,
      lastRepValid,
      depthProgress,
      lockoutProgress,
      side,
    };
  }

  function depthProgressFor(deg: number): number {
    const span = cfg.downEnterDeg - cfg.minDepthDeg;
    if (span <= 1) return deg <= cfg.minDepthDeg ? 1 : 0;
    return clamp01((cfg.downEnterDeg - deg) / span);
  }

  function lockoutProgressFor(deg: number): number {
    const span = cfg.lockoutDeg - cfg.downEnterDeg;
    if (span <= 1) return deg >= cfg.lockoutDeg ? 1 : 0;
    return clamp01((deg - cfg.downEnterDeg) / span);
  }

  function setConfig(next: Partial<AngleRepConfig>) {
    cfg = { ...cfg, ...next };
  }

  function reset() {
    phase = "unknown";
    repsValidas = 0;
    repsInvalidas = 0;
    formHits = 0;
    formTotal = 0;
    amplitudeSum = 0;
    amplitudeCount = 0;
    minInRep = null;
    formOkInRep = true;
    lastRepValid = null;
    feedback = "need_pose";
    angle = null;
    align = null;
    side = null;
    depthProgress = 0;
    lockoutProgress = 0;
    return snapshot();
  }

  function update(landmarks: LandmarkPoint[] | null | undefined): ExerciseCounterSnapshot {
    if (!landmarks || landmarks.length < 29) {
      feedback = "need_pose";
      angle = null;
      align = null;
      side = null;
      depthProgress = 0;
      lockoutProgress = 0;
      return snapshot();
    }

    const read = opts.read(landmarks);
    side = read.side;
    angle = read.angle;
    align = read.align;

    if (angle == null || !side) {
      feedback = "need_pose";
      depthProgress = 0;
      lockoutProgress = 0;
      return snapshot();
    }

    depthProgress = depthProgressFor(angle);
    lockoutProgress = lockoutProgressFor(angle);

    const aligned =
      cfg.minAlignDeg == null || align == null ? true : align >= cfg.minAlignDeg;
    if (!aligned) {
      formOkInRep = false;
      feedback = "align_body";
    }

    if (phase === "unknown") {
      if (angle >= cfg.upEnterDeg) {
        phase = "up";
        feedback = aligned ? "go_down" : "align_body";
      } else if (angle <= cfg.downEnterDeg) {
        phase = "down";
        minInRep = angle;
        formOkInRep = aligned;
        feedback = aligned ? "go_up" : "align_body";
      } else {
        feedback = "go_down";
      }
      return snapshot();
    }

    if (phase === "up") {
      if (angle <= cfg.downEnterDeg) {
        phase = "down";
        minInRep = angle;
        formOkInRep = aligned;
        feedback = aligned ? "deeper" : "align_body";
      } else if (angle < cfg.lockoutDeg) {
        feedback = aligned ? "lockout" : "align_body";
      } else {
        feedback = aligned ? "go_down" : "align_body";
      }
      return snapshot();
    }

    // down
    if (minInRep == null || angle < minInRep) minInRep = angle;
    if (!aligned) formOkInRep = false;

    if (angle >= cfg.upEnterDeg) {
      const depth = minInRep ?? angle;
      const deepEnough = depth <= cfg.minDepthDeg;
      const lockoutOk = angle >= cfg.lockoutDeg;
      const valid = deepEnough && lockoutOk && formOkInRep;

      formTotal += 1;
      if (formOkInRep) formHits += 1;

      if (valid) {
        repsValidas += 1;
        amplitudeSum += cfg.depthToAmplitude(depth);
        amplitudeCount += 1;
        lastRepValid = true;
        feedback = "rep_valid";
      } else {
        repsInvalidas += 1;
        lastRepValid = false;
        feedback = !deepEnough ? "deeper" : !lockoutOk ? "lockout" : "rep_invalid";
      }

      phase = "up";
      minInRep = null;
      formOkInRep = true;
      return snapshot();
    }

    if ((minInRep ?? 999) > cfg.minDepthDeg) {
      feedback = aligned ? "deeper" : "align_body";
    } else {
      feedback = aligned ? "go_up" : "align_body";
    }
    return snapshot();
  }

  return { update, reset, snapshot, setConfig };
}

export type AngleRepCounter = ReturnType<typeof createAngleRepCounter>;
