/**
 * Enquadramento do corpo na guia — lógica pura (testável sem câmera).
 */

import { LM, type LandmarkPoint } from "./pushup-counter";

export type GuideRect = {
  /** 0–1 no espaço normalizado do frame */
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Guia central — ombros/cotovelos/mãos devem caber aqui (estilo Push Up Boss). */
export const DEFAULT_GUIDE: GuideRect = {
  x: 0.12,
  y: 0.14,
  w: 0.76,
  h: 0.62,
};

export type FramingIssue =
  | "no_pose"
  | "shoulders"
  | "elbows"
  | "wrists"
  | "hips"
  | "outside_guide"
  | "too_small"
  | "too_large";

export type FramingReport = {
  ok: boolean;
  issues: FramingIssue[];
  /** Fração dos pontos-chave dentro da guia (0–1) */
  coverage: number;
  /** Distância ombro–ombro normalizada (proxy de distância à câmera) */
  shoulderSpan: number | null;
};

function vis(p: LandmarkPoint | undefined): number {
  return p?.visibility ?? 0;
}

function inRect(p: LandmarkPoint, g: GuideRect, pad = 0.02): boolean {
  return (
    p.x >= g.x - pad &&
    p.x <= g.x + g.w + pad &&
    p.y >= g.y - pad &&
    p.y <= g.y + g.h + pad
  );
}

const KEY_GROUPS: Array<{ issue: FramingIssue; idxs: number[]; minVis: number }> = [
  { issue: "shoulders", idxs: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER], minVis: 0.45 },
  { issue: "elbows", idxs: [LM.LEFT_ELBOW, LM.RIGHT_ELBOW], minVis: 0.4 },
  { issue: "wrists", idxs: [LM.LEFT_WRIST, LM.RIGHT_WRIST], minVis: 0.35 },
  { issue: "hips", idxs: [LM.LEFT_HIP, LM.RIGHT_HIP], minVis: 0.3 },
];

export function evaluateFraming(
  landmarks: LandmarkPoint[] | null | undefined,
  guide: GuideRect = DEFAULT_GUIDE,
): FramingReport {
  if (!landmarks || landmarks.length < 29) {
    return { ok: false, issues: ["no_pose"], coverage: 0, shoulderSpan: null };
  }

  const issues: FramingIssue[] = [];
  const visiblePts: LandmarkPoint[] = [];

  for (const group of KEY_GROUPS) {
    const pts = group.idxs
      .map((i) => landmarks[i])
      .filter((p): p is LandmarkPoint => !!p && vis(p) >= group.minVis);
    if (pts.length < 1) {
      issues.push(group.issue);
      continue;
    }
    // Ombros: exige os dois quando possível
    if (group.issue === "shoulders" && pts.length < 2) {
      issues.push(group.issue);
      continue;
    }
    visiblePts.push(...pts);
  }

  const ls = landmarks[LM.LEFT_SHOULDER];
  const rs = landmarks[LM.RIGHT_SHOULDER];
  let shoulderSpan: number | null = null;
  if (ls && rs && vis(ls) >= 0.4 && vis(rs) >= 0.4) {
    shoulderSpan = Math.hypot(ls.x - rs.x, ls.y - rs.y);
    if (shoulderSpan < 0.08) issues.push("too_small");
    if (shoulderSpan > 0.55) issues.push("too_large");
  }

  let inside = 0;
  for (const p of visiblePts) {
    if (inRect(p, guide)) inside += 1;
  }
  const coverage = visiblePts.length > 0 ? inside / visiblePts.length : 0;
  if (visiblePts.length > 0 && coverage < 0.7) {
    issues.push("outside_guide");
  }

  const blocking = issues.filter(
    (i) => i !== "too_small" && i !== "too_large",
  );
  // Distância só avisa; fora da guia / partes faltando bloqueiam
  const ok =
    blocking.length === 0 &&
    !issues.includes("too_small") &&
    !issues.includes("too_large");

  return { ok, issues: [...new Set(issues)], coverage, shoulderSpan };
}

export const FRAMING_COPY: Record<FramingIssue, string> = {
  no_pose: "Entre no quadro — corpo visível.",
  shoulders: "Mostre os dois ombros.",
  elbows: "Cotovelos precisam aparecer.",
  wrists: "Mãos/punhos na câmera.",
  hips: "Inclua o quadril no enquadramento.",
  outside_guide: "Centralize o tronco na guia.",
  too_small: "Aproxime-se um pouco da câmera.",
  too_large: "Afaste-se um pouco da câmera.",
};

export function framingCoachMessage(report: FramingReport): string {
  if (report.ok) return "Perfeito — mantenha essa posição.";
  const first = report.issues[0];
  return first ? FRAMING_COPY[first] : "Ajuste o enquadramento.";
}
