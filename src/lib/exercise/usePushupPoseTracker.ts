import { useEffect, useRef, useState } from "react";
import type { LandmarkPoint } from "@/lib/exercise/pushup-counter";
import { getPoseLandmarker, landmarksFromResult } from "@/lib/exercise/pose-landmarker";
import {
  createPushupSession,
  type PushupSessionSnapshot,
} from "@/lib/exercise/pushup-session";
import { drawPushupOverlay } from "@/lib/exercise/pushup-overlay";

export type UsePushupPoseTrackerOptions = {
  enabled: boolean;
  video: HTMLVideoElement | null;
  canvas?: HTMLCanvasElement | null;
  mirrored?: boolean;
};

const EMPTY_SESSION: PushupSessionSnapshot = {
  stage: "framing",
  framing: { ok: false, issues: ["no_pose"], coverage: 0, shoulderSpan: null },
  calibration: {
    progress: 0,
    holding: false,
    message: "Entre na posição alta e fique parado.",
    samples: 0,
    meanLockout: null,
    meanAlign: null,
    ready: false,
  },
  counter: {
    phase: "unknown",
    repsValidas: 0,
    repsInvalidas: 0,
    amplitudeMedia: 0,
    formaPct: 100,
    elbowAngle: null,
    bodyAlignAngle: null,
    feedback: "need_pose",
    lastRepValid: null,
    depthProgress: 0,
    lockoutProgress: 0,
    side: null,
  },
  coachMessage: "Encaixe ombros, cotovelos e mãos na guia.",
  flash: null,
  guide: { x: 0.12, y: 0.14, w: 0.76, h: 0.62 },
};

export function usePushupPoseTracker(opts: UsePushupPoseTrackerOptions) {
  const [session, setSession] = useState<PushupSessionSnapshot>(EMPTY_SESSION);
  const [ready, setReady] = useState(false);
  const [poseError, setPoseError] = useState<string | null>(null);
  const sessionRef = useRef(createPushupSession());
  const rafRef = useRef(0);
  const lastTsRef = useRef(-1);
  const busyRef = useRef(false);
  const canvasRef = useRef(opts.canvas ?? null);
  const mirroredRef = useRef(opts.mirrored ?? false);

  canvasRef.current = opts.canvas ?? null;
  mirroredRef.current = opts.mirrored ?? false;

  useEffect(() => {
    if (!opts.enabled) {
      sessionRef.current.reset();
      setSession(EMPTY_SESSION);
      setReady(false);
      setPoseError(null);
      return;
    }

    let cancelled = false;
    setPoseError(null);
    setReady(false);
    sessionRef.current = createPushupSession();
    setSession(sessionRef.current.snapshot());

    void getPoseLandmarker()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        if (!cancelled) {
          setPoseError(
            e instanceof Error ? e.message : "Falha ao carregar o modelo de pose.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [opts.enabled]);

  useEffect(() => {
    if (!opts.enabled || !ready || !opts.video) return;

    let alive = true;
    const video = opts.video;
    lastTsRef.current = -1;
    busyRef.current = false;

    const tick = () => {
      if (!alive) return;
      rafRef.current = requestAnimationFrame(tick);

      if (busyRef.current) return;
      if (video.readyState < 2 || video.videoWidth <= 0) return;

      const now = performance.now();
      if (now <= lastTsRef.current) return;

      busyRef.current = true;
      void (async () => {
        try {
          const landmarker = await getPoseLandmarker();
          if (!alive) return;
          const result = landmarker.detectForVideo(video, now);
          lastTsRef.current = now;
          const lms = landmarksFromResult(result);
          const mapped: LandmarkPoint[] | null = lms
            ? lms.map((p) => ({
                x: p.x,
                y: p.y,
                z: p.z,
                visibility: p.visibility,
              }))
            : null;
          const next = sessionRef.current.update(mapped, now);
          if (alive) setSession(next);
          drawPushupOverlay(
            canvasRef.current,
            video,
            mapped,
            next,
            mirroredRef.current,
          );
        } catch (e) {
          console.warn("[pushup-pose]", e);
        } finally {
          busyRef.current = false;
        }
      })();
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [opts.enabled, opts.video, ready]);

  const recalibrate = () => {
    const next = sessionRef.current.recalibrate();
    setSession(next);
  };

  return {
    session,
    /** @deprecated use session.counter */
    snapshot: session.counter,
    ready,
    poseError,
    recalibrate,
  };
}
