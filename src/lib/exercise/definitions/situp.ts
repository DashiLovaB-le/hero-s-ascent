import { createAngleRepCounter } from "../angle-rep-counter";
import {
  DEFAULT_GUIDE,
  hipTrunkAngle,
  pickLegSide,
  type LandmarkPoint,
} from "../pose-math";
import { sessionFromDefinitionParts } from "./session";
import type { ExerciseDefinition } from "./types";

const COPY = {
  need_pose: "De lado — tronco e quadril visíveis.",
  go_down: "Desça o tronco (crunch).",
  go_up: "Volte controlando.",
  deeper: "Suba mais o tronco.",
  lockout: "Estenda no chão.",
  align_body: "Movimento controlado.",
  hold: "",
  hold_break: "",
  rep_valid: "Abdominal válido.",
  rep_invalid: "Repetição incompleta.",
};

/**
 * Sit-up: ângulo ombro–quadril–joelho.
 * No chão (esticado) o ângulo é maior; no crunch, menor.
 */
function readTrunk(landmarks: LandmarkPoint[]) {
  const side = pickLegSide(landmarks) ?? "right";
  const angle = hipTrunkAngle(landmarks, side);
  return { angle, align: angle, side };
}

export const situpDefinition: ExerciseDefinition = {
  slug: "situp",
  nome: "Abdominal",
  shortBlurb: "Core — flexão de tronco de lado.",
  mode: "reps",
  region: "core",
  guide: DEFAULT_GUIDE,
  requireAnkles: true,
  feedbackCopy: COPY,
  createSession: () =>
    sessionFromDefinitionParts(
      situpDefinition,
      () =>
        createAngleRepCounter({
          // No sit-up o "up" (esticado) tem ângulo alto; "down" (crunch) ângulo baixo
          config: {
            downEnterDeg: 130,
            upEnterDeg: 155,
            minDepthDeg: 110,
            lockoutDeg: 150,
            minAlignDeg: null,
            depthToAmplitude: (minDeg) => {
              const clamped = Math.min(150, Math.max(90, minDeg));
              return Math.round(((150 - clamped) / (150 - 90)) * 100);
            },
          },
          read: readTrunk,
        }),
      (lms) => readTrunk(lms).angle,
    ),
};
