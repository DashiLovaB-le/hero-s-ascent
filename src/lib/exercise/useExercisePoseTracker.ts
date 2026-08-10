import { useEffect, useRef, useState } from "react";
import type { LandmarkPoint } from "@/lib/exercise/pose-math";
import { getPoseLandmarker, landmarksFromResult } from "@/lib/exercise/pose-landmarker";
import { getExerciseDefinition } from "@/lib/exercise/registry";
import type { ExerciseSessionSnapshot } from "@/lib/exercise/definitions/types";
import { drawExerciseOverlay } from "@/lib/exercise/exercise-overlay";

export type UseExercisePoseTrackerOptions = {
  slug: string;
  enabled: boolean;
  video: HTMLVideoElement | null;
  canvas?: HTMLCanvasElement | null;
  mirrored?: boolean;
};

const FALLBACK: ExerciseSessionSnapshot = {
  stage: "framing",
  framing: { ok: false, issues: ["no_pose"], coverage: 0, shoulderSpan: null },
  calibration: {
    progress: 0,
    holding: false,
    message: "Entre na posição e fique parado.",
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
  coachMessage: "Enquadre o corpo na guia.",
  flash: null,
  guide: { x: 0.12, y: 0.1, w: 0.76, h: 0.78 },
  mode: "reps",
};

export function useExercisePoseTracker(opts: UseExercisePoseTrackerOptions) {
  const def = getExerciseDefinition(opts.slug);
  const [session, setSession] = useState<ExerciseSessionSnapshot>(FALLBACK);
  const [ready, setReady] = useState(false);
  const [poseError, setPoseError] = useState<string | null>(null);
  const sessionRef = useRef(def ? def.createSession() : null);
  const rafRef = useRef(0);
  const lastTsRef = useRef(-1);
  const busyRef = useRef(false);
  const canvasRef = useRef(opts.canvas ?? null);
  const mirroredRef = useRef(opts.mirrored ?? false);
  const slugRef = useRef(opts.slug);

  canvasRef.current = opts.canvas ?? null;
  mirroredRef.current = opts.mirrored ?? false;
  slugRef.current = opts.slug;

  useEffect(() => {
    if (!opts.enabled || !def) {
      sessionRef.current?.reset();
      setSession(FALLBACK);
      setReady(false);
      setPoseError(def ? null : `Exercício desconhecido: ${opts.slug}`);
      return;
    }

    let cancelled = false;
    setPoseError(null);
    setReady(false);
    sessionRef.current = def.createSession();
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
  }, [opts.enabled, opts.slug, def]);

  useEffect(() => {
    if (!opts.enabled || !ready || !opts.video || !sessionRef.current) return;

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
          if (!alive || !sessionRef.current) return;
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
          drawExerciseOverlay(
            canvasRef.current,
            video,
            mapped,
            next,
            mirroredRef.current,
          );
        } catch (e) {
          console.warn("[exercise-pose]", slugRef.current, e);
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
    if (!sessionRef.current) return;
    setSession(sessionRef.current.recalibrate());
  };

  return {
    session,
    ready,
    poseError,
    recalibrate,
    definition: def,
  };
}
