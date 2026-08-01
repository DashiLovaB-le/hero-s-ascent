/**
 * Orquestra framing → calibração → contagem (estilo Push Up Boss).
 */

import {
  configFromCalibration,
  createCalibrator,
  type CalibrationSnapshot,
} from "./pushup-calibration";
import {
  createPushupCounter,
  pickSide,
  sideElbowAngle,
  bodyAlignAngle,
  type LandmarkPoint,
  type PushupCounterSnapshot,
  type PushupFeedbackCode,
  PUSHUP_FEEDBACK_COPY,
} from "./pushup-counter";
import {
  evaluateFraming,
  framingCoachMessage,
  type FramingReport,
  DEFAULT_GUIDE,
  type GuideRect,
} from "./pushup-framing";

export type SessionStage = "framing" | "calibrating" | "tracking";

export type PushupSessionSnapshot = {
  stage: SessionStage;
  framing: FramingReport;
  calibration: CalibrationSnapshot;
  counter: PushupCounterSnapshot;
  coachMessage: string;
  /** Flash curto após rep válida/inválida */
  flash: "valid" | "invalid" | null;
  guide: GuideRect;
};

const EMPTY_COUNTER: PushupCounterSnapshot = {
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
};

export function createPushupSession(guide: GuideRect = DEFAULT_GUIDE) {
  let stage: SessionStage = "framing";
  const calibrator = createCalibrator();
  const counter = createPushupCounter();
  let framing: FramingReport = {
    ok: false,
    issues: ["no_pose"],
    coverage: 0,
    shoulderSpan: null,
  };
  let calibration = calibrator.reset();
  let counterSnap = counter.snapshot();
  let flash: "valid" | "invalid" | null = null;
  let flashUntil = 0;
  let framedOkSince = 0;
  let lastRepsValid = 0;
  let lastRepsInvalid = 0;

  function coachMessage(): string {
    if (stage === "framing") return framingCoachMessage(framing);
    if (stage === "calibrating") return calibration.message;
    if (flash === "valid") return PUSHUP_FEEDBACK_COPY.rep_valid;
    if (flash === "invalid") {
      const code = counterSnap.feedback;
      return PUSHUP_FEEDBACK_COPY[code] ?? PUSHUP_FEEDBACK_COPY.rep_invalid;
    }
    return PUSHUP_FEEDBACK_COPY[counterSnap.feedback as PushupFeedbackCode];
  }

  function snapshot(nowMs = 0): PushupSessionSnapshot {
    if (flash && nowMs >= flashUntil) flash = null;
    return {
      stage,
      framing,
      calibration,
      counter: counterSnap,
      coachMessage: coachMessage(),
      flash,
      guide,
    };
  }

  function recalibrate() {
    stage = "framing";
    framedOkSince = 0;
    calibration = calibrator.reset();
    counterSnap = counter.reset();
    flash = null;
    lastRepsValid = 0;
    lastRepsInvalid = 0;
    return snapshot();
  }

  function reset() {
    return recalibrate();
  }

  function update(
    landmarks: LandmarkPoint[] | null | undefined,
    nowMs: number,
  ): PushupSessionSnapshot {
    framing = evaluateFraming(landmarks, guide);

    const side =
      landmarks && landmarks.length >= 29 ? pickSide(landmarks) : null;
    const elbow =
      landmarks && side ? sideElbowAngle(landmarks, side) : null;
    const align =
      landmarks && side ? bodyAlignAngle(landmarks, side) : null;

    // Histerese: 400ms estável enquadrado antes de ir para calibração
    if (stage === "framing") {
      counterSnap = {
        ...EMPTY_COUNTER,
        elbowAngle: elbow,
        bodyAlignAngle: align,
        side,
        feedback: "need_pose",
      };
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
        counterSnap = {
          ...EMPTY_COUNTER,
          elbowAngle: elbow,
          bodyAlignAngle: align,
          side,
          feedback: "need_pose",
        };
        return snapshot(nowMs);
      }

      calibration = calibrator.update(nowMs, framing.ok, elbow, align);
      counterSnap = {
        ...EMPTY_COUNTER,
        elbowAngle: elbow,
        bodyAlignAngle: align,
        side,
        feedback: "lockout",
        lockoutProgress: elbow != null && elbow >= 140 ? Math.min(1, (elbow - 140) / 35) : 0,
      };

      if (calibration.ready && calibration.meanLockout != null) {
        const cfg = configFromCalibration(
          calibration.meanLockout,
          calibration.meanAlign,
        );
        counter.setConfig(cfg);
        counter.reset();
        stage = "tracking";
        counterSnap = counter.snapshot();
      }
      return snapshot(nowMs);
    }

    // tracking
    counterSnap = counter.update(landmarks);

    if (counterSnap.repsValidas > lastRepsValid) {
      flash = "valid";
      flashUntil = nowMs + 900;
      lastRepsValid = counterSnap.repsValidas;
    } else if (counterSnap.repsInvalidas > lastRepsInvalid) {
      flash = "invalid";
      flashUntil = nowMs + 900;
      lastRepsInvalid = counterSnap.repsInvalidas;
    }

    return snapshot(nowMs);
  }

  return {
    update,
    reset,
    recalibrate,
    snapshot: () => snapshot(),
    getCounter: () => counter,
  };
}

export type PushupSession = ReturnType<typeof createPushupSession>;
