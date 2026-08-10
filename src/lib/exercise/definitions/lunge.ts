import { createAngleRepCounter } from "../angle-rep-counter";
import {
  DEFAULT_GUIDE,
  kneeAngle,
  pickLegSide,
  type LandmarkPoint,
} from "../pose-math";
import { sessionFromDefinitionParts } from "./session";
import type { ExerciseDefinition } from "./types";

/** MVP: perna fixa (lado mais visível) — mais estável que alternado. */
const COPY = {
  need_pose: "De lado — mostre o afundo completo.",
  go_down: "Desça o joelho de trás.",
  go_up: "Empurre até subir.",
  deeper: "Desça mais o joelho.",
  lockout: "Estenda no topo.",
  align_body: "Tronco ereto.",
  hold: "",
  hold_break: "",
  rep_valid: "Afundo válido.",
  rep_invalid: "Repetição incompleta.",
};

function readFrontKnee(landmarks: LandmarkPoint[]) {
  const side = pickLegSide(landmarks);
  if (!side) return { angle: null, align: null, side: null };
  // Usa o joelho com menor ângulo (perna da frente em flexão)
  const l = kneeAngle(landmarks, "left");
  const r = kneeAngle(landmarks, "right");
  if (l == null && r == null) return { angle: null, align: null, side: null };
  if (l == null) return { angle: r, align: r, side: "right" as const };
  if (r == null) return { angle: l, align: l, side: "left" as const };
  return l <= r
    ? { angle: l, align: l, side: "left" as const }
    : { angle: r, align: r, side: "right" as const };
}

export const lungeDefinition: ExerciseDefinition = {
  slug: "lunge",
  nome: "Afundo",
  shortBlurb: "Pernas e equilíbrio — perna da frente (MVP).",
  mode: "reps",
  region: "legs",
  guide: DEFAULT_GUIDE,
  requireAnkles: true,
  feedbackCopy: COPY,
  createSession: () =>
    sessionFromDefinitionParts(
      lungeDefinition,
      () =>
        createAngleRepCounter({
          config: {
            downEnterDeg: 125,
            upEnterDeg: 155,
            minDepthDeg: 100,
            lockoutDeg: 150,
            minAlignDeg: null,
            depthToAmplitude: (minDeg) => {
              const clamped = Math.min(140, Math.max(70, minDeg));
              return Math.round(((140 - clamped) / (140 - 70)) * 100);
            },
          },
          read: readFrontKnee,
        }),
      (lms) => readFrontKnee(lms).angle,
    ),
};
