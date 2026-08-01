/**
 * Calibração ao corpo do herói — limiares adaptativos a partir do lockout.
 */

import {
  DEFAULT_PUSHUP_CONFIG,
  type PushupCounterConfig,
} from "./pushup-counter";

export type CalibrationConfig = {
  /** Tempo contínuo estável exigido (ms) */
  holdMs: number;
  /** Desvio máximo do cotovelo entre amostras para considerar “parado” */
  maxElbowJitterDeg: number;
  /** Ângulo mínimo do cotovelo para aceitar como posição alta */
  minLockoutDeg: number;
  sampleEveryMs: number;
};

export const DEFAULT_CALIBRATION: CalibrationConfig = {
  holdMs: 2800,
  maxElbowJitterDeg: 8,
  minLockoutDeg: 140,
  sampleEveryMs: 80,
};

export type CalibrationSnapshot = {
  progress: number;
  holding: boolean;
  message: string;
  samples: number;
  meanLockout: number | null;
  meanAlign: number | null;
  ready: boolean;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Deriva limiares a partir do ângulo de lockout calibrado do usuário.
 * Garante downEnter > minDepth e upEnter >= lockoutDeg.
 */
export function configFromCalibration(
  lockoutElbowDeg: number,
  bodyAlignDeg: number | null,
): PushupCounterConfig {
  const lockout = clamp(lockoutElbowDeg, 148, 178);
  const rom = lockout - 68; // amplitude esperada até o fundo
  const lockoutDeg = clamp(lockout - 4, 145, 172);
  const upEnterDeg = clamp(lockout - 10, 148, 170);
  const downEnterDeg = clamp(lockout - rom * 0.32, 108, 128);
  const minDepthDeg = clamp(lockout - rom * 0.62, 72, 102);
  const alignBase = bodyAlignDeg ?? 165;
  const minBodyAlignDeg = clamp(Math.min(148, alignBase - 18), 132, 152);

  // Invariantes de segurança
  const safeDown = Math.min(downEnterDeg, upEnterDeg - 25);
  const safeDepth = Math.min(minDepthDeg, safeDown - 12);

  return {
    ...DEFAULT_PUSHUP_CONFIG,
    lockoutDeg: Math.min(lockoutDeg, upEnterDeg),
    upEnterDeg,
    downEnterDeg: safeDown,
    minDepthDeg: safeDepth,
    minBodyAlignDeg,
  };
}

export function createCalibrator(cfg: CalibrationConfig = DEFAULT_CALIBRATION) {
  let progressMs = 0;
  let lastSampleAt = -1;
  let lastElbow: number | null = null;
  let sumLockout = 0;
  let sumAlign = 0;
  let alignCount = 0;
  let samples = 0;
  let ready = false;
  let meanLockout: number | null = null;
  let meanAlign: number | null = null;

  function snapshot(holding: boolean, message: string): CalibrationSnapshot {
    return {
      progress: clamp(progressMs / cfg.holdMs, 0, 1),
      holding,
      message,
      samples,
      meanLockout,
      meanAlign,
      ready,
    };
  }

  function reset() {
    progressMs = 0;
    lastSampleAt = -1;
    lastElbow = null;
    sumLockout = 0;
    sumAlign = 0;
    alignCount = 0;
    samples = 0;
    ready = false;
    meanLockout = null;
    meanAlign = null;
    return snapshot(false, "Entre na posição alta e fique parado.");
  }

  /**
   * @returns snapshot; quando `ready`, chame `configFromCalibration(meanLockout, meanAlign)`.
   */
  function update(
    nowMs: number,
    framed: boolean,
    elbowDeg: number | null,
    alignDeg: number | null,
  ): CalibrationSnapshot {
    if (ready) {
      return snapshot(true, "Calibrado. Pode começar.");
    }

    if (!framed || elbowDeg == null) {
      progressMs = 0;
      lastElbow = null;
      return snapshot(false, "Encaixe o corpo na guia, braços estendidos.");
    }

    if (elbowDeg < cfg.minLockoutDeg) {
      progressMs = 0;
      lastElbow = elbowDeg;
      return snapshot(false, "Estenda os braços no topo e segure.");
    }

    const jitter =
      lastElbow == null ? 0 : Math.abs(elbowDeg - lastElbow);
    if (jitter > cfg.maxElbowJitterDeg) {
      progressMs = Math.max(0, progressMs - cfg.sampleEveryMs * 2);
      lastElbow = elbowDeg;
      return snapshot(false, "Menos movimento — segure a prancha.");
    }

    if (lastSampleAt < 0) lastSampleAt = nowMs;
    const dt = Math.min(200, Math.max(0, nowMs - lastSampleAt));
    lastSampleAt = nowMs;
    lastElbow = elbowDeg;

    if (dt >= cfg.sampleEveryMs * 0.5) {
      sumLockout += elbowDeg;
      samples += 1;
      if (alignDeg != null) {
        sumAlign += alignDeg;
        alignCount += 1;
      }
      progressMs += dt;
    }

    meanLockout = samples > 0 ? sumLockout / samples : null;
    meanAlign = alignCount > 0 ? sumAlign / alignCount : null;

    if (progressMs >= cfg.holdMs && meanLockout != null && samples >= 8) {
      ready = true;
      return snapshot(true, "Calibrado. Pode começar.");
    }

    const secs = Math.ceil((cfg.holdMs - progressMs) / 1000);
    return snapshot(true, `Calibrando… segure ${secs}s`);
  }

  return { update, reset, snapshot: () => snapshot(false, "Entre na posição alta e fique parado.") };
}

export type Calibrator = ReturnType<typeof createCalibrator>;
