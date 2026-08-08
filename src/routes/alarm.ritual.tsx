import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { CHARLIE_ALARM_AUDIO_PATH } from "@/lib/charlie-call/client";
import { logCharlieAlarmEvent } from "@/lib/charlie-call/functions";

export const Route = createFileRoute("/alarm/ritual")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    callId: typeof search.callId === "string" ? search.callId : undefined,
    audioKey: typeof search.audioKey === "string" ? search.audioKey : "classico",
    mode: typeof search.mode === "string" ? search.mode : "alarm",
  }),
  component: AlarmRitualPage,
});

function AlarmRitualPage() {
  const { callId, audioKey } = Route.useSearch();
  const logFn = useServerFn(logCharlieAlarmEvent);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [missing, setMissing] = useState(false);

  const src =
    audioKey && audioKey !== "classico"
      ? `/audio/charlie-alarm-${audioKey}.m4a`
      : CHARLIE_ALARM_AUDIO_PATH;

  useEffect(() => {
    void logFn({
      data: { outcome: "answered", platform: "android", call_id: callId, meta: { audioKey } },
    }).catch(() => undefined);
  }, [callId, audioKey, logFn]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const play = async () => {
      try {
        await el.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    };
    void play();
  }, [src]);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-6 py-10 text-center">
      <div className="absolute inset-0 bg-background" aria-hidden />
      <div className="relative z-10 max-w-md">
        <p className="text-xs uppercase tracking-[0.2em] text-hero">Charlie</p>
        <h1 className="mt-3 font-display text-3xl font-bold">O dia começou.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Levanta, respira, e marca o primeiro hábito. A jornada não espera.
        </p>

        <audio
          ref={audioRef}
          src={src}
          preload="auto"
          onError={() => setMissing(true)}
          onEnded={() => setPlaying(false)}
          className="mt-6 w-full"
          controls
        />

        {missing ? (
          <p className="mt-2 text-xs text-amber-400">
            Áudio não encontrado. Coloque o arquivo em{" "}
            <code className="text-white/80">public/audio/charlie-alarm-classico.m4a</code>
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="shadow-hero">
            <Link to="/habits">Ir para hábitos</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/mentor">Falar com Charlie</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/journey">Pronto</Link>
          </Button>
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground">
          {playing ? "Tocando mensagem do mentor…" : "Toque em play se o áudio não iniciar sozinho."}
        </p>
      </div>
    </div>
  );
}
