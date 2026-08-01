/**
 * Contagem de flexão por ângulo de cotovelo — lógica pura (testável sem câmera).
 */

export type LandmarkPoint = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type PushupPhase = "unknown" | "up" | "down";

export type PushupFeedbackCode =
  | "need_pose"
  | "go_down"
  | "go_up"
  | "deeper"
  | "lockout"
  | "align_body"
  | "rep_valid"
  | "rep_invalid";

export type PushupCounterSnapshot = {
  phase: PushupPhase;
  repsValidas: number;
  repsInvalidas: number;
  /** 0–100, média das amplitudes das reps válidas */
  amplitudeMedia: number;
  /** 0–100 */
  formaPct: number;
  elbowAngle: number | null;
  bodyAlignAngle: number | null;
  feedback: PushupFeedbackCode;
  lastRepValid: boolean | null;
  /** 0–1 progresso de profundidade na descida atual */
  depthProgress: number;
  /** 0–1 quão perto do lockout */
  lockoutProgress: number;
  side: "left" | "right" | null;
};

export type PushupCounterConfig = {
  /** Entra em DOWN quando ângulo do cotovelo cai abaixo disso */
  downEnterDeg: number;
  /** Volta a UP quando ângulo sobe acima disso */
  upEnterDeg: number;
  /** Rep válida precisa atingir profundidade (ângulo mínimo) abaixo disso */
  minDepthDeg: number;
  /** Lockout mínimo no topo para fechar a rep */
  lockoutDeg: number;
  /** Alinhamento ombro-quadril-tornozelo: abaixo disso = corpo desalinhado */
  minBodyAlignDeg: number;
  minVisibility: number;
};

export const DEFAULT_PUSHUP_CONFIG: PushupCounterConfig = {
  downEnterDeg: 120,
  upEnterDeg: 155,
  minDepthDeg: 95,
  lockoutDeg: 150,
  minBodyAlignDeg: 145,
  minVisibility: 0.45,
};

// MediaPipe Pose indices
export const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export function angleAtDeg(
  a: LandmarkPoint,
  b: LandmarkPoint,
  c: LandmarkPoint,
): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (mag < 1e-8) return 180;
  const cos = Math.min(1, Math.max(-1, (abx * cbx + aby * cby) / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

function vis(p: LandmarkPoint | undefined): number {
  return p?.visibility ?? 0;
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export function pickSide(landmarks: LandmarkPoint[]): "left" | "right" | null {
  const l =
    vis(landmarks[LM.LEFT_SHOULDER]) +
    vis(landmarks[LM.LEFT_ELBOW]) +
    vis(landmarks[LM.LEFT_WRIST]);
  const r =
    vis(landmarks[LM.RIGHT_SHOULDER]) +
    vis(landmarks[LM.RIGHT_ELBOW]) +
    vis(landmarks[LM.RIGHT_WRIST]);
  if (l < 0.45 * 3 && r < 0.45 * 3) return null;
  return l >= r ? "left" : "right";
}

export function sideElbowAngle(
  landmarks: LandmarkPoint[],
  side: "left" | "right",
): number | null {
  const sh = side === "left" ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
  const el = side === "left" ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW;
  const wr = side === "left" ? LM.LEFT_WRIST : LM.RIGHT_WRIST;
  const a = landmarks[sh];
  const b = landmarks[el];
  const c = landmarks[wr];
  if (!a || !b || !c) return null;
  if (vis(a) < 0.35 || vis(b) < 0.35 || vis(c) < 0.35) return null;
  return angleAtDeg(a, b, c);
}

export function bodyAlignAngle(
  landmarks: LandmarkPoint[],
  side: "left" | "right",
): number | null {
  const sh = side === "left" ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
  const hip = side === "left" ? LM.LEFT_HIP : LM.RIGHT_HIP;
  const ankle = side === "left" ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;
  const a = landmarks[sh];
  const b = landmarks[hip];
  const c = landmarks[ankle];
  if (!a || !b || !c) return null;
  if (vis(a) < 0.3 || vis(b) < 0.3 || vis(c) < 0.25) return null;
  return angleAtDeg(a, b, c);
}

/** Converte profundidade (ângulo mínimo do cotovelo) em amplitude 0–100. */
export function depthToAmplitude(minElbowDeg: number): number {
  const clamped = Math.min(120, Math.max(55, minElbowDeg));
  return Math.round(((120 - clamped) / (120 - 55)) * 100);
}

export function depthProgressFor(
  elbowDeg: number,
  config: PushupCounterConfig,
): number {
  const span = config.downEnterDeg - config.minDepthDeg;
  if (span <= 1) return elbowDeg <= config.minDepthDeg ? 1 : 0;
  return clamp01((config.downEnterDeg - elbowDeg) / span);
}

export function lockoutProgressFor(
  elbowDeg: number,
  config: PushupCounterConfig,
): number {
  const span = config.lockoutDeg - config.downEnterDeg;
  if (span <= 1) return elbowDeg >= config.lockoutDeg ? 1 : 0;
  return clamp01((elbowDeg - config.downEnterDeg) / span);
}

export function createPushupCounter(config: PushupCounterConfig = DEFAULT_PUSHUP_CONFIG) {
  let cfg = { ...config };
  let phase: PushupPhase = "unknown";
  let repsValidas = 0;
  let repsInvalidas = 0;
  let formHits = 0;
  let formTotal = 0;
  let amplitudeSum = 0;
  let amplitudeCount = 0;
  let minElbowInRep: number | null = null;
  let formOkInRep = true;
  let lastRepValid: boolean | null = null;
  let feedback: PushupFeedbackCode = "need_pose";
  let elbowAngle: number | null = null;
  let bodyAlign: number | null = null;
  let side: "left" | "right" | null = null;
  let depthProgress = 0;
  let lockoutProgress = 0;

  function snapshot(): PushupCounterSnapshot {
    return {
      phase,
      repsValidas,
      repsInvalidas,
      amplitudeMedia:
        amplitudeCount > 0 ? Math.round(amplitudeSum / amplitudeCount) : 0,
      formaPct: formTotal > 0 ? Math.round((formHits / formTotal) * 100) : 100,
      elbowAngle,
      bodyAlignAngle: bodyAlign,
      feedback,
      lastRepValid,
      depthProgress,
      lockoutProgress,
      side,
    };
  }

  function setConfig(next: PushupCounterConfig) {
    cfg = { ...next };
  }

  function getConfig() {
    return { ...cfg };
  }

  function reset() {
    phase = "unknown";
    repsValidas = 0;
    repsInvalidas = 0;
    formHits = 0;
    formTotal = 0;
    amplitudeSum = 0;
    amplitudeCount = 0;
    minElbowInRep = null;
    formOkInRep = true;
    lastRepValid = null;
    feedback = "need_pose";
    elbowAngle = null;
    bodyAlign = null;
    side = null;
    depthProgress = 0;
    lockoutProgress = 0;
    return snapshot();
  }

  function update(landmarks: LandmarkPoint[] | null | undefined): PushupCounterSnapshot {
    if (!landmarks || landmarks.length < 29) {
      feedback = "need_pose";
      elbowAngle = null;
      bodyAlign = null;
      side = null;
      depthProgress = 0;
      lockoutProgress = 0;
      return snapshot();
    }

    side = pickSide(landmarks);
    if (!side) {
      feedback = "need_pose";
      elbowAngle = null;
      bodyAlign = null;
      depthProgress = 0;
      lockoutProgress = 0;
      return snapshot();
    }

    elbowAngle = sideElbowAngle(landmarks, side);
    bodyAlign = bodyAlignAngle(landmarks, side);
    if (elbowAngle == null) {
      feedback = "need_pose";
      depthProgress = 0;
      lockoutProgress = 0;
      return snapshot();
    }

    depthProgress = depthProgressFor(elbowAngle, cfg);
    lockoutProgress = lockoutProgressFor(elbowAngle, cfg);

    const aligned =
      bodyAlign == null ? true : bodyAlign >= cfg.minBodyAlignDeg;
    if (!aligned) {
      formOkInRep = false;
      feedback = "align_body";
    }

    if (phase === "unknown") {
      if (elbowAngle >= cfg.upEnterDeg) {
        phase = "up";
        feedback = aligned ? "go_down" : "align_body";
      } else if (elbowAngle <= cfg.downEnterDeg) {
        phase = "down";
        minElbowInRep = elbowAngle;
        formOkInRep = aligned;
        feedback = aligned ? "go_up" : "align_body";
      } else {
        feedback = "go_down";
      }
      return snapshot();
    }

    if (phase === "up") {
      if (elbowAngle <= cfg.downEnterDeg) {
        phase = "down";
        minElbowInRep = elbowAngle;
        formOkInRep = aligned;
        feedback = aligned ? "deeper" : "align_body";
      } else if (elbowAngle < cfg.lockoutDeg) {
        feedback = aligned ? "lockout" : "align_body";
      } else {
        feedback = aligned ? "go_down" : "align_body";
      }
      return snapshot();
    }

    // phase === "down"
    if (minElbowInRep == null || elbowAngle < minElbowInRep) {
      minElbowInRep = elbowAngle;
    }
    if (!aligned) formOkInRep = false;

    if (elbowAngle >= cfg.upEnterDeg) {
      const depth = minElbowInRep ?? elbowAngle;
      const deepEnough = depth <= cfg.minDepthDeg;
      const lockoutOk = elbowAngle >= cfg.lockoutDeg;
      const valid = deepEnough && lockoutOk && formOkInRep;

      formTotal += 1;
      if (formOkInRep) formHits += 1;

      if (valid) {
        repsValidas += 1;
        const amp = depthToAmplitude(depth);
        amplitudeSum += amp;
        amplitudeCount += 1;
        lastRepValid = true;
        feedback = "rep_valid";
      } else {
        repsInvalidas += 1;
        lastRepValid = false;
        feedback = !deepEnough ? "deeper" : !lockoutOk ? "lockout" : "rep_invalid";
      }

      phase = "up";
      minElbowInRep = null;
      formOkInRep = true;
      return snapshot();
    }

    if ((minElbowInRep ?? 999) > cfg.minDepthDeg) {
      feedback = aligned ? "deeper" : "align_body";
    } else {
      feedback = aligned ? "go_up" : "align_body";
    }
    return snapshot();
  }

  return { update, reset, snapshot, setConfig, getConfig };
}

export type PushupCounter = ReturnType<typeof createPushupCounter>;

export const PUSHUP_FEEDBACK_COPY: Record<PushupFeedbackCode, string> = {
  need_pose: "Enquadre o corpo inteiro na câmera.",
  go_down: "Desça com controle.",
  go_up: "Empurre até o topo.",
  deeper: "Abaixa o peito — mais fundo.",
  lockout: "Trava no topo — braços estendidos.",
  align_body: "Trave a prancha — corpo em linha.",
  rep_valid: "Flexão válida.",
  rep_invalid: "Repetição incompleta.",
};
