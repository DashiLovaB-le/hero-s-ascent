import { createHoldCounter } from "../hold-counter";
import { DEFAULT_GUIDE, jointAngle, LM, pickArmSide } from "../pose-math";
import { sessionFromDefinitionParts } from "./session";
import type { ExerciseDefinition } from "./types";

const COPY = {
  need_pose: "Corpo inteiro na câmera — posição de prancha.",
  go_down: "",
  go_up: "",
  deeper: "",
  lockout: "Trave a linha ombro–quadril–tornozelo.",
  align_body: "Alinhe o corpo.",
  hold: "Segure — respire.",
  hold_break: "Quadril caindo — volte à linha.",
  rep_valid: "Hold válido.",
  rep_invalid: "Prancha quebrada.",
};

export const plankDefinition: ExerciseDefinition = {
  slug: "plank",
  nome: "Prancha",
  shortBlurb: "Core isométrico — tempo com alinhamento.",
  mode: "hold",
  region: "core",
  guide: DEFAULT_GUIDE,
  requireAnkles: true,
  feedbackCopy: COPY,
  minHoldSecToFinish: 5,
  createSession: () =>
    sessionFromDefinitionParts(
      plankDefinition,
      () => createHoldCounter(),
      (lms) => {
        const side = pickArmSide(lms);
        if (!side) return null;
        const sh = side === "left" ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
        const hip = side === "left" ? LM.LEFT_HIP : LM.RIGHT_HIP;
        const ankle = side === "left" ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;
        return jointAngle(lms, sh, hip, ankle, 0.25);
      },
    ),
};
