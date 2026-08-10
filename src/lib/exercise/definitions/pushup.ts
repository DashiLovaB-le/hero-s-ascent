import {
  createPushupSession,
  type PushupSessionSnapshot,
} from "../pushup-session";
import { PUSHUP_FEEDBACK_COPY } from "../pushup-counter";
import { PUSHUP_GUIDE, type LandmarkPoint } from "../pose-math";
import type { ExerciseDefinition, ExerciseSessionController } from "./types";
import type { ExerciseCounterSnapshot } from "../pose-math";

function adapt(snap: PushupSessionSnapshot) {
  return {
    ...snap,
    mode: "reps" as const,
    counter: snap.counter as unknown as ExerciseCounterSnapshot,
  };
}

function wrapPushupSession(): ExerciseSessionController {
  const inner = createPushupSession(PUSHUP_GUIDE);
  return {
    update: (lms, now) => adapt(inner.update(lms, now)),
    reset: () => adapt(inner.reset()),
    recalibrate: () => adapt(inner.recalibrate()),
    snapshot: () => adapt(inner.snapshot()),
  };
}

export const pushupDefinition: ExerciseDefinition = {
  slug: "pushup",
  nome: "Flexão",
  shortBlurb: "Peito, tríceps e core — contagem por cotovelo.",
  mode: "reps",
  region: "push",
  guide: PUSHUP_GUIDE,
  requireAnkles: false,
  feedbackCopy: PUSHUP_FEEDBACK_COPY,
  createSession: wrapPushupSession,
};
