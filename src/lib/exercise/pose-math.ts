/**
 * Tipos e math compartilhados do Exercise Engine (MediaPipe Pose).
 */

export type LandmarkPoint = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export function angleAtDeg(a: LandmarkPoint, b: LandmarkPoint, c: LandmarkPoint): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag < 1e-8) return 180;
  const cos = Math.min(1, Math.max(-1, (abx * cbx + aby * cby) / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function vis(p: LandmarkPoint | undefined): number {
  return p?.visibility ?? 0;
}

export function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export function pickSideBy(
  landmarks: LandmarkPoint[],
  idxs: { left: number[]; right: number[] },
  minSum = 0.45 * 3,
): "left" | "right" | null {
  const sum = (arr: number[]) => arr.reduce((a, i) => a + vis(landmarks[i]), 0);
  const l = sum(idxs.left);
  const r = sum(idxs.right);
  if (l < minSum && r < minSum) return null;
  return l >= r ? "left" : "right";
}

export function pickArmSide(landmarks: LandmarkPoint[]): "left" | "right" | null {
  return pickSideBy(landmarks, {
    left: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST],
    right: [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  });
}

export function pickLegSide(landmarks: LandmarkPoint[]): "left" | "right" | null {
  return pickSideBy(landmarks, {
    left: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE],
    right: [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  });
}

export function jointAngle(
  landmarks: LandmarkPoint[],
  aIdx: number,
  bIdx: number,
  cIdx: number,
  minVis = 0.3,
): number | null {
  const a = landmarks[aIdx];
  const b = landmarks[bIdx];
  const c = landmarks[cIdx];
  if (!a || !b || !c) return null;
  if (vis(a) < minVis || vis(b) < minVis || vis(c) < minVis) return null;
  return angleAtDeg(a, b, c);
}

export function kneeAngle(
  landmarks: LandmarkPoint[],
  side: "left" | "right",
): number | null {
  const hip = side === "left" ? LM.LEFT_HIP : LM.RIGHT_HIP;
  const knee = side === "left" ? LM.LEFT_KNEE : LM.RIGHT_KNEE;
  const ankle = side === "left" ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;
  return jointAngle(landmarks, hip, knee, ankle, 0.28);
}

export function hipTrunkAngle(
  landmarks: LandmarkPoint[],
  side: "left" | "right",
): number | null {
  const sh = side === "left" ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
  const hip = side === "left" ? LM.LEFT_HIP : LM.RIGHT_HIP;
  const knee = side === "left" ? LM.LEFT_KNEE : LM.RIGHT_KNEE;
  return jointAngle(landmarks, sh, hip, knee, 0.28);
}

export type ExercisePhase = "unknown" | "up" | "down" | "hold";

export type ExerciseFeedbackCode =
  | "need_pose"
  | "go_down"
  | "go_up"
  | "deeper"
  | "lockout"
  | "align_body"
  | "hold"
  | "hold_break"
  | "rep_valid"
  | "rep_invalid";

/** Snapshot unificado (compatível com a UI da flexão). */
export type ExerciseCounterSnapshot = {
  phase: ExercisePhase;
  repsValidas: number;
  repsInvalidas: number;
  amplitudeMedia: number;
  formaPct: number;
  /** Ângulo principal (cotovelo/joelho/etc.) */
  elbowAngle: number | null;
  bodyAlignAngle: number | null;
  feedback: ExerciseFeedbackCode;
  lastRepValid: boolean | null;
  depthProgress: number;
  lockoutProgress: number;
  side: "left" | "right" | null;
  /** Hold acumulado em ms (prancha). */
  holdMs?: number;
};

export type GuideRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export const DEFAULT_GUIDE: GuideRect = {
  x: 0.12,
  y: 0.1,
  w: 0.76,
  h: 0.78,
};

export const PUSHUP_GUIDE: GuideRect = {
  x: 0.12,
  y: 0.14,
  w: 0.76,
  h: 0.62,
};
