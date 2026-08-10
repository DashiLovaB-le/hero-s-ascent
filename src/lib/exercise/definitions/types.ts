import type { GuideRect, LandmarkPoint, ExerciseCounterSnapshot } from "../pose-math";
import type { FramingReport } from "../pushup-framing";
import type { CalibrationSnapshot } from "../pushup-calibration";

export type ExerciseMode = "reps" | "hold";

export type ExerciseSessionStage = "framing" | "calibrating" | "tracking";

export type ExerciseSessionSnapshot = {
  stage: ExerciseSessionStage;
  framing: FramingReport;
  calibration: CalibrationSnapshot;
  counter: ExerciseCounterSnapshot;
  coachMessage: string;
  flash: "valid" | "invalid" | null;
  guide: GuideRect;
  mode: ExerciseMode;
};

export type ExerciseSessionController = {
  update: (
    landmarks: LandmarkPoint[] | null | undefined,
    nowMs: number,
  ) => ExerciseSessionSnapshot;
  reset: () => ExerciseSessionSnapshot;
  recalibrate: () => ExerciseSessionSnapshot;
  snapshot: () => ExerciseSessionSnapshot;
};

export type ExerciseDefinition = {
  slug: string;
  nome: string;
  shortBlurb: string;
  mode: ExerciseMode;
  /** Região para o hub */
  region: "push" | "legs" | "core" | "posterior" | "full";
  guide: GuideRect;
  /** Framing: exigir tornozelos (corpo inteiro) */
  requireAnkles?: boolean;
  feedbackCopy: Record<string, string>;
  createSession: () => ExerciseSessionController;
  /** Segundos mínimos de hold para poder finalizar (hold mode) */
  minHoldSecToFinish?: number;
};

export type ExerciseCatalogItem = {
  slug: string;
  nome: string;
  shortBlurb: string;
  region: ExerciseDefinition["region"];
  mode: ExerciseMode;
  /** Já tem seed no banco / pode abrir sessão */
  available: boolean;
};
