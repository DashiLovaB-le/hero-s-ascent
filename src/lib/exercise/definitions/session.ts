/**
 * Sessão genérica: framing → calibração leve → tracking (reps ou hold).
 */

import {
  createCalibrator,
  type CalibrationSnapshot,
} from "../pushup-calibration";
import {
  evaluateFraming,
  framingCoachMessage,
  type FramingReport,
} from "../pushup-framing";
import {
  DEFAULT_GUIDE,
  type ExerciseCounterSnapshot,
  type ExerciseFeedbackCode,
  type GuideRect,
  type LandmarkPoint,
} from "../pose-math";
import type {
  ExerciseDefinition,
  ExerciseMode,
  ExerciseSessionController,
  ExerciseSessionSnapshot,
  ExerciseSessionStage,
} from "./types";

type CounterLike = {
  update: (
    landmarks: LandmarkPoint[] | null | undefined,
    nowMs: number,
  ) => ExerciseCounterSnapshot;
  reset: () => ExerciseCounterSnapshot;
  snapshot: () => ExerciseCounterSnapshot;
};

const EMPTY_COUNTER: ExerciseCounterSnapshot = {
  phase: "unknown",
  repsValidas: 0,
  repsInvalidas: 0,
  amplitudeMedia: 0,
  formaPct: 100,
  elbowAngle: null,
  bodyAlignAngle: null,
  feedback: "need_pose",
  lastRepValid: null,
  depthProgress: 0,
  lockoutProgress: 0,
  side: null,
  holdMs: 0,
};

export function createGenericExerciseSession(opts: {
  mode: ExerciseMode;
  guide?: GuideRect;
  requireAnkles?: boolean;
  feedbackCopy: Record<string, string>;
  createCounter: () => CounterLike;
  /** Calibração: exige ângulo “alto” se fornecido */
  readLockoutAngle?: (landmarks: LandmarkPoint[]) => number | null;
}): ExerciseSessionController {
  const guide = opts.guide ?? DEFAULT_GUIDE;
  let stage: ExerciseSessionStage = "framing";
  const calibrator = createCalibrator();
  let counter = opts.createCounter();
  let framing: FramingReport = {
    ok: false,
    issues: ["no_pose"],
    coverage: 0,
    shoulderSpan: null,
  };
  let calibration: CalibrationSnapshot = calibrator.reset();
  let counterSnap = counter.snapshot();
  let flash: "valid" | "invalid" | null = null;
  let flashUntil = 0;
  let framedOkSince = 0;
  let lastRepsValid = 0;
  let lastRepsInvalid = 0;

  function coachMessage(): string {
    if (stage === "framing") return framingCoachMessage(framing);
    if (stage === "calibrating") return calibration.message;
    if (flash === "valid") {
      return opts.feedbackCopy.rep_valid ?? "Boa!";
    }
    if (flash === "invalid") {
      return (
        opts.feedbackCopy[counterSnap.feedback] ??
        opts.feedbackCopy.rep_invalid ??
        "Incompleto."
      );
    }
    return (
      opts.feedbackCopy[counterSnap.feedback as ExerciseFeedbackCode] ??
      opts.feedbackCopy.need_pose ??
      "Continue."
    );
  }

  function snapshot(nowMs = 0): ExerciseSessionSnapshot {
    if (flash && nowMs >= flashUntil) flash = null;
    return {
      stage,
      framing,
      calibration,
      counter: counterSnap,
      coachMessage: coachMessage(),
      flash,
      guide,
      mode: opts.mode,
    };
  }

  function recalibrate() {
    stage = "framing";
    framedOkSince = 0;
    calibration = calibrator.reset();
    counter = opts.createCounter();
    counterSnap = counter.snapshot();
    flash = null;
    lastRepsValid = 0;
    lastRepsInvalid = 0;
    return snapshot();
  }

  function update(
    landmarks: LandmarkPoint[] | null | undefined,
    nowMs: number,
  ): ExerciseSessionSnapshot {
    framing = evaluateFraming(landmarks, guide, {
      requireAnkles: opts.requireAnkles,
    });

    const lockout =
      landmarks && opts.readLockoutAngle
        ? opts.readLockoutAngle(landmarks)
        : landmarks
          ? (counter.snapshot().elbowAngle ?? null)
          : null;

    if (stage === "framing") {
      counterSnap = { ...EMPTY_COUNTER, feedback: "need_pose" };
      if (framing.ok) {
        if (!framedOkSince) framedOkSince = nowMs;
        if (nowMs - framedOkSince >= 400) {
          stage = "calibrating";
          calibration = calibrator.reset();
        }
      } else {
        framedOkSince = 0;
      }
      return snapshot(nowMs);
    }

    if (stage === "calibrating") {
      if (!framing.ok) {
        stage = "framing";
        framedOkSince = 0;
        calibration = calibrator.reset();
        counterSnap = { ...EMPTY_COUNTER, feedback: "need_pose" };
        return snapshot(nowMs);
      }

      // Reusa calibrador da flexão (lockout = ângulo alto)
      calibration = calibrator.update(
        nowMs,
        framing.ok,
        lockout ?? 160,
        170,
      );
      counterSnap = {
        ...EMPTY_COUNTER,
        elbowAngle: lockout,
        feedback: "lockout",
        lockoutProgress:
          lockout != null && lockout >= 140
            ? Math.min(1, (lockout - 140) / 35)
            : 0,
      };

      if (calibration.ready) {
        counter = opts.createCounter();
        counterSnap = counter.reset();
        stage = "tracking";
      }
      return snapshot(nowMs);
    }

    // tracking
    counterSnap = counter.update(landmarks, nowMs);

    if (opts.mode === "reps") {
      if (counterSnap.repsValidas > lastRepsValid) {
        flash = "valid";
        flashUntil = nowMs + 900;
        lastRepsValid = counterSnap.repsValidas;
      } else if (counterSnap.repsInvalidas > lastRepsInvalid) {
        flash = "invalid";
        flashUntil = nowMs + 900;
        lastRepsInvalid = counterSnap.repsInvalidas;
      }
    }

    return snapshot(nowMs);
  }

  return {
    update,
    reset: recalibrate,
    recalibrate,
    snapshot: () => snapshot(),
  };
}

/** Factory helper used by definitions. */
export function sessionFromDefinitionParts(
  def: Pick<
    ExerciseDefinition,
    "mode" | "guide" | "requireAnkles" | "feedbackCopy"
  >,
  createCounter: () => CounterLike,
  readLockoutAngle?: (landmarks: LandmarkPoint[]) => number | null,
): ExerciseSessionController {
  return createGenericExerciseSession({
    mode: def.mode,
    guide: def.guide,
    requireAnkles: def.requireAnkles,
    feedbackCopy: def.feedbackCopy,
    createCounter,
    readLockoutAngle,
  });
}
