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
  need_pose: "Deitado de lado — mostre ombro, quadril e joelho.",
  go_down: "Abaixe o quadril.",
  go_up: "Empurre o quadril para cima.",
  deeper: "Suba mais o quadril.",
  lockout: "No chão, glúteo relaxado.",
  align_body: "Linha do tronco estável.",
  hold: "",
  hold_break: "",
  rep_valid: "Elevação válida.",
  rep_invalid: "Repetição incompleta.",
};

/**
 * Glute bridge: ângulo ombro–quadril–joelho.
 * No chão (baixo) ângulo menor; ponte (alto) ângulo maior — invertido vs squat.
 * Usamos a mesma máquina invertendo via thresholds: "down" = ponte (ângulo alto? )
 *
 * Na prática com y-image: de lado, ponte aumenta ângulo no quadril.
 * Tratamos ângulo ALTO = posição de ponte = "down" na FSM (fase de trabalho),
 * e ângulo BAIXO = no chão = "up"/reset — isso quebra a convenção do AngleRepCounter.
 *
 * Solução: inverter a leitura (180 - angle) para reutilizar o counter.
 */
function readBridge(landmarks: LandmarkPoint[]) {
  const side = pickLegSide(landmarks) ?? "right";
  const raw = hipTrunkAngle(landmarks, side);
  if (raw == null) return { angle: null, align: null, side: null };
  const inverted = 180 - raw;
  return { angle: inverted, align: inverted, side };
}

export const gluteBridgeDefinition: ExerciseDefinition = {
  slug: "glute_bridge",
  nome: "Elevação de quadril",
  shortBlurb: "Posterior e glúteo — ponte no chão.",
  mode: "reps",
  region: "posterior",
  guide: DEFAULT_GUIDE,
  requireAnkles: true,
  feedbackCopy: COPY,
  createSession: () =>
    sessionFromDefinitionParts(
      gluteBridgeDefinition,
      () =>
        createAngleRepCounter({
          config: {
            downEnterDeg: 100,
            upEnterDeg: 130,
            minDepthDeg: 85,
            lockoutDeg: 125,
            minAlignDeg: null,
            depthToAmplitude: (minDeg) => {
              const clamped = Math.min(120, Math.max(60, minDeg));
              return Math.round(((120 - clamped) / (120 - 60)) * 100);
            },
          },
          read: readBridge,
        }),
      (lms) => readBridge(lms).angle,
    ),
};
