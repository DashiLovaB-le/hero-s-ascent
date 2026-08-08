import { useCallback, useEffect, useRef, useState } from "react";
import { ensureCameraPermission } from "@/lib/platform";

export type ExerciseCameraState = "idle" | "starting" | "live" | "error";

export type UseExerciseCameraOptions = {
  /** Preferência: frontal (user) para o herói se ver. */
  facingMode?: "user" | "environment";
  enabled: boolean;
};

/**
 * Preview ao vivo via getUserMedia — sem MediaRecorder / sem upload de vídeo.
 */
export function useExerciseCamera(opts: UseExerciseCameraOptions) {
  const facingMode = opts.facingMode ?? "user";
  const streamRef = useRef<MediaStream | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [state, setState] = useState<ExerciseCameraState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [streamGen, setStreamGen] = useState(0);

  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    setVideoEl(node);
  }, []);

  const stopTracks = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    stopTracks();
    if (videoEl) videoEl.srcObject = null;
    setState("idle");
    setError(null);
  }, [stopTracks, videoEl]);

  const start = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Este dispositivo/navegador não permite acesso à câmera.");
      setState("error");
      return;
    }

    stopTracks();
    if (videoEl) videoEl.srcObject = null;
    setError(null);
    setState("starting");

    try {
      const perm = await ensureCameraPermission();
      if (!perm.ok) {
        setError(perm.message);
        setState("error");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          // Mobile: resolução moderada = MediaPipe mais estável / menos thermal throttle
          width: { ideal: 960 },
          height: { ideal: 540 },
        },
      });
      streamRef.current = stream;
      setStreamGen((n) => n + 1);
      setState("live");
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Permissão da câmera negada. Libere o acesso nas configurações do app ou do navegador."
          : e instanceof Error
            ? e.message
            : "Não foi possível abrir a câmera.";
      setError(msg);
      setState("error");
    }
  }, [facingMode, stopTracks, videoEl]);

  useEffect(() => {
    if (!opts.enabled) {
      stop();
      return;
    }
    void start();
    return () => {
      stopTracks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start/stop identity handled via facingMode/enabled
  }, [opts.enabled, facingMode]);

  useEffect(() => {
    if (!videoEl || !streamRef.current || !opts.enabled) return;
    videoEl.srcObject = streamRef.current;
    videoEl.muted = true;
    videoEl.playsInline = true;
    void videoEl.play().catch(() => {
      /* autoplay policies — playsInline+muted usually ok */
    });
  }, [videoEl, streamGen, opts.enabled, state]);

  return { videoRef, videoEl, state, error, start, stop };
}
