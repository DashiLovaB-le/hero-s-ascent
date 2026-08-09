import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { getMorningBriefing, logCharlieAlarmEvent } from "@/lib/charlie-call/functions";
import { runQueryFn } from "@/lib/safe-query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alarm/ritual")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    callId: typeof search.callId === "string" ? search.callId : undefined,
    audioKey: typeof search.audioKey === "string" ? search.audioKey : "classic",
    mode: typeof search.mode === "string" ? search.mode : "alarm",
  }),
  component: AlarmRitualPage,
});

function AlarmRitualPage() {
  const { callId, audioKey } = Route.useSearch();
  const navigate = useNavigate();
  const logFn = useServerFn(logCharlieAlarmEvent);
  const briefFn = useServerFn(getMorningBriefing);

  useEffect(() => {
    void logFn({
      data: {
        outcome: "answered",
        platform: "android",
        call_id: callId,
        meta: { audioKey },
      },
    }).catch(() => undefined);
  }, [callId, audioKey, logFn]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["morning-briefing", callId] as const,
    queryFn: () => runQueryFn(() => briefFn(), "Falha ao montar o resumo do dia."),
    staleTime: 60_000,
  });

  function handleLevantou() {
    void navigate({ to: "/journey", replace: true });
  }

  return (
    <div
      data-native-keyboard-page
      className="relative flex min-h-dvh flex-col px-5 py-10"
      style={{
        paddingTop: "max(2.5rem, calc(var(--safe-area-inset-top, 0px) + 1rem))",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[#1B1B1B]" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(252,110,32,0.25), transparent 55%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-hero">
          Charlie
        </p>
        <h1 className="mt-3 text-center font-display text-2xl font-bold leading-tight sm:text-3xl">
          {isLoading ? "Preparando o briefing…" : (data?.greeting ?? "Bom dia, herói.")}
        </h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {data?.message ??
            "Levanta. O dia já começou — marque o que importa e avance."}
        </p>

        <div className="mt-8 space-y-4 rounded-none border border-hero/30 bg-black/35 p-4">
          <section>
            <h2 className="font-display text-xs uppercase tracking-[0.18em] text-hero">Clima</h2>
            {isLoading ? (
              <p className="mt-2 text-sm text-white/50">Consultando o céu…</p>
            ) : data?.weatherLine ? (
              <p className="mt-2 text-sm text-white/85">{data.weatherLine}</p>
            ) : (
              <p className="mt-2 text-sm text-white/45">
                Sem região no perfil — configure a cidade para o Charlie trazer o clima.
              </p>
            )}
          </section>

          <section>
            <h2 className="font-display text-xs uppercase tracking-[0.18em] text-hero">
              Principais tarefas
            </h2>
            {isLoading ? (
              <p className="mt-2 text-sm text-white/50">Carregando frentes…</p>
            ) : isError ? (
              <p className="mt-2 text-sm text-amber-300/90">Não deu para listar agora. Siga para a jornada.</p>
            ) : data?.tasks?.length ? (
              <ul className="mt-2 space-y-2">
                {data.tasks.map((t) => (
                  <li
                    key={`${t.kind}-${t.id}`}
                    className={cn(
                      "border-l-2 border-hero/70 pl-3 text-sm text-white/90",
                    )}
                  >
                    <span className="text-[10px] uppercase tracking-wider text-white/40">
                      {t.kind === "habit" ? "hábito" : "meta"}
                    </span>
                    <div>{t.title}</div>
                    {t.detail ? (
                      <p className="mt-0.5 text-xs text-white/50">{t.detail}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-white/45">Nenhuma pendência listada para hoje.</p>
            )}
          </section>
        </div>

        <div className="mt-auto pt-8">
          <Button
            type="button"
            className="h-14 w-full rounded-none font-display text-base font-bold tracking-wide shadow-hero [clip-path:polygon(0_0,100%_0,100%_72%,88%_100%,0_100%)]"
            onClick={handleLevantou}
          >
            LEVANTEI
          </Button>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Fecha o ritual e abre a Jornada.
          </p>
        </div>
      </div>
    </div>
  );
}
