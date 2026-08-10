import type { LandmarkPoint } from "./pose-math";
import { drawPushupOverlay } from "./pushup-overlay";
import type { ExerciseSessionSnapshot } from "./definitions/types";
import type { PushupSessionSnapshot } from "./pushup-session";

/** Overlay genérico — reutiliza o renderer da flexão (guia + skeleton + meters). */
export function drawExerciseOverlay(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement,
  landmarks: LandmarkPoint[] | null,
  session: ExerciseSessionSnapshot,
  mirrored: boolean,
) {
  drawPushupOverlay(
    canvas,
    video,
    landmarks as never,
    session as unknown as PushupSessionSnapshot,
    mirrored,
  );
}
