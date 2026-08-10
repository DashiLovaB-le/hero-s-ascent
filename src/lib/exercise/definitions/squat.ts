import { createAngleRepCounter } from "../angle-rep-counter";
import {
  DEFAULT_GUIDE,
  kneeAngle,
  pickLegSide,
  type LandmarkPoint,
} from "../pose-math";
import { sessionFromDefinitionParts } from "./session";
import type { ExerciseDefinition } from "./types";

const COPY = {
  need_pose: "Enquadre o corpo inteiro de lado.",
  go_down: "Desça o quadril.",
  go_up: "Suba até ficar de pé.",
  deeper: "Desça mais — joelhos dobrando.",
  lockout: "Estenda as pernas no topo.",
  align_body: "Mantenha o tronco estável.",
  hold: "",
  hold_break: "",
  rep_valid: "Agachamento válido.",
  rep_invalid: "Repetição incompleta.",
};

function readKnee(landmarks: LandmarkPoint[]) {
  const side = pickLegSide(landmarks);
  if (!side) return { angle: null, align: null, side: null };
  const angle = kneeAngle(landmarks, side);
  return { angle, align: angle, side };
}

export const squatDefinition: ExerciseDefinition = {
  slug: "squat",
  nome: "Agachamento",
  shortBlurb: "Pernas e glúteo — profundidade pelo joelho.",
  mode: "reps",
  region: "legs",
  guide: DEFAULT_GUIDE,
  requireAnkles: true,
  feedbackCopy: COPY,
  createSession: () =>
    sessionFromDefinitionParts(
      squatDefinition,
      () =>
        createAngleRepCounter({
          config: {
            downEnterDeg: 130,
            upEnterDeg: 155,
            minDepthDeg: 100,
            lockoutDeg: 150,
            minAlignDeg: null,
            depthToAmplitude: (minDeg) => {
              const clamped = Math.min(140, Math.max(70, minDeg));
              return Math.round(((140 - clamped) / (140 - 70)) * 100);
            },
          },
          read: readKnee,
        }),
      (lms) => readKnee(lms).angle,
    ),
};
