/**
 * Overlay de coaching: guia, calibração, esqueleto colorido, barra de profundidade.
 */

import type { LandmarkPoint } from "./pushup-counter";
import { LM } from "./pushup-counter";
import type { GuideRect } from "./pushup-framing";
import type { PushupSessionSnapshot } from "./pushup-session";

const PAIRS: Array<[number, number]> = [
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_ANKLE],
  [LM.RIGHT_HIP, LM.RIGHT_ANKLE],
];

const JOINTS = [
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_ELBOW,
  LM.RIGHT_ELBOW,
  LM.LEFT_WRIST,
  LM.RIGHT_WRIST,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
];

function colorForSession(session: PushupSessionSnapshot): {
  stroke: string;
  fill: string;
} {
  if (session.flash === "valid") {
    return { stroke: "rgba(52, 211, 153, 0.95)", fill: "rgba(167, 243, 208, 0.95)" };
  }
  if (session.flash === "invalid" || session.counter.feedback === "align_body") {
    return { stroke: "rgba(251, 191, 36, 0.95)", fill: "rgba(253, 230, 138, 0.95)" };
  }
  if (session.stage === "calibrating" && session.calibration.holding) {
    return { stroke: "rgba(96, 165, 250, 0.95)", fill: "rgba(191, 219, 254, 0.95)" };
  }
  if (session.framing.ok) {
    return { stroke: "rgba(52, 211, 153, 0.9)", fill: "rgba(167, 243, 208, 0.9)" };
  }
  return { stroke: "rgba(232, 93, 4, 0.9)", fill: "rgba(255, 231, 208, 0.95)" };
}

export function drawPushupOverlay(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement,
  landmarks: LandmarkPoint[] | null,
  session: PushupSessionSnapshot,
  mirrored: boolean,
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = video.clientWidth;
  const h = video.clientHeight;
  if (w < 2 || h < 2) return;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  ctx.clearRect(0, 0, w, h);

  drawGuide(ctx, w, h, session.guide, session);
  if (session.stage === "calibrating") {
    drawCalibrationRing(ctx, w, h, session.calibration.progress);
  }
  if (session.stage === "tracking") {
    drawDepthMeter(ctx, w, h, session);
  }

  if (!landmarks) return;

  const mapX = (x: number) => (mirrored ? 1 - x : x) * w;
  const mapY = (y: number) => y * h;
  const { stroke, fill } = colorForSession(session);

  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;

  for (const [a, b] of PAIRS) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb) continue;
    if ((pa.visibility ?? 0) < 0.35 || (pb.visibility ?? 0) < 0.35) continue;
    ctx.beginPath();
    ctx.moveTo(mapX(pa.x), mapY(pa.y));
    ctx.lineTo(mapX(pb.x), mapY(pb.y));
    ctx.stroke();
  }

  for (const idx of JOINTS) {
    const p = landmarks[idx];
    if (!p || (p.visibility ?? 0) < 0.35) continue;
    const isElbow = idx === LM.LEFT_ELBOW || idx === LM.RIGHT_ELBOW;
    const r = isElbow ? 7 : 4.5;
    ctx.beginPath();
    ctx.arc(mapX(p.x), mapY(p.y), r, 0, Math.PI * 2);
    ctx.fill();
    if (isElbow) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function drawGuide(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  guide: GuideRect,
  session: PushupSessionSnapshot,
) {
  const x = guide.x * w;
  const y = guide.y * h;
  const gw = guide.w * w;
  const gh = guide.h * h;
  const ok = session.framing.ok || session.stage === "tracking";
  const col = ok ? "rgba(52, 211, 153, 0.85)" : "rgba(255, 255, 255, 0.55)";
  const len = Math.min(28, gw * 0.12, gh * 0.12);

  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 3;
  ctx.lineCap = "square";

  // Cantos estilo viewfinder
  const corners: Array<[number, number, number, number, number, number]> = [
    [x, y + len, x, y, x + len, y],
    [x + gw - len, y, x + gw, y, x + gw, y + len],
    [x, y + gh - len, x, y + gh, x + len, y + gh],
    [x + gw - len, y + gh, x + gw, y + gh, x + gw, y + gh - len],
  ];
  for (const [x1, y1, x2, y2, x3, y3] of corners) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.stroke();
  }

  if (session.stage !== "tracking") {
    ctx.fillStyle = ok ? "rgba(52, 211, 153, 0.06)" : "rgba(255, 255, 255, 0.03)";
    ctx.fillRect(x, y, gw, gh);
  }
  ctx.restore();
}

function drawCalibrationRing(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  progress: number,
) {
  const cx = w / 2;
  const cy = h * 0.78;
  const r = Math.min(36, w * 0.08);
  ctx.save();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(96, 165, 250, 0.95)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `600 ${Math.round(r * 0.55)}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(progress * 100)}%`, cx, cy);
  ctx.restore();
}

function drawDepthMeter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  session: PushupSessionSnapshot,
) {
  const barW = Math.min(18, w * 0.04);
  const barH = h * 0.36;
  const x = w - barW - 14;
  const y = (h - barH) / 2;
  const depth = session.counter.depthProgress;
  const lock = session.counter.lockoutProgress;
  const phase = session.counter.phase;

  ctx.save();
  // Track
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, x, y, barW, barH, 6);
  ctx.fill();

  // Fill from top (lockout) to bottom (depth) — visual: bar grows downward as you go deeper
  const fillH = barH * (phase === "down" || phase === "unknown" ? depth : lock);
  const fillColor =
    phase === "down"
      ? depth >= 1
        ? "rgba(52, 211, 153, 0.95)"
        : "rgba(232, 93, 4, 0.9)"
      : lock >= 1
        ? "rgba(52, 211, 153, 0.95)"
        : "rgba(96, 165, 250, 0.9)";

  ctx.fillStyle = fillColor;
  const fy = phase === "down" ? y + barH - fillH : y;
  roundRect(ctx, x + 2, fy, barW - 4, Math.max(2, fillH), 4);
  ctx.fill();

  // Meta de profundidade
  const targetY = y + barH * 0.85;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 3, targetY);
  ctx.lineTo(x + barW + 3, targetY);
  ctx.stroke();

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
