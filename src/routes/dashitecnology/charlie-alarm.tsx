import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  Panel,
  StatCard,
  StatGrid,
} from "@/admin/ui";
import { runQueryFn } from "@/lib/safe-query";
import {
  adminGetCharlieAlarmConfig,
  adminSetCharlieAlarmConfig,
} from "@/lib/charlie-call/functions";
import {
  CHARLIE_RINGTONES,
  normalizeRingtoneKey,
  presentCharlieCall,
  type CharlieRingtoneKey,
} from "@/lib/charlie-call/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isNativePlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashitecnology/charlie-alarm")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "charlie-alarm"],
      queryFn: () => runQueryFn(() => adminGetCharlieAlarmConfig(), "Falha config despertador."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => (
    <AdminError error={error instanceof Error ? error : new Error(String(error))} />
  ),
  component: CharlieAlarmAdminPage,
});

function CharlieAlarmAdminPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetCharlieAlarmConfig);
  const setFn = useServerFn(adminSetCharlieAlarmConfig);

  const { data } = useQuery({
    queryKey: ["admin", "charlie-alarm"],
    queryFn: () => runQueryFn(() => getFn(), "Falha config despertador."),
  });

  const [enabled, setEnabled] = useState(data?.enabled ?? true);
  const [reason, setReason] = useState(data?.defaultReason ?? "Hora de subir");
  const [audioKey, setAudioKey] = useState<CharlieRingtoneKey>(
    normalizeRingtoneKey(data?.defaultAudioKey),
  );

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setReason(data.defaultReason);
    setAudioKey(normalizeRingtoneKey(data.defaultAudioKey));
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () =>
      setFn({
        data: {
          enabled,
          defaultReason: reason,
          defaultAudioKey: normalizeRingtoneKey(audioKey),
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "charlie-alarm"] });
      toast.success("Configs fortes salvas.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell
      title="Charlie Call / Despertador"
      subtitle="Configs fortes (kill switch, copy, toque). Opt-in do herói fica no Perfil."
    >
      <StatGrid>
        <StatCard label="Feature global" value={data?.enabled ? "ON" : "OFF"} />
        <StatCard label="Heróis com alarme on" value={data?.enabledUsers ?? 0} />
        <StatCard
          label="Toque default"
          value={normalizeRingtoneKey(data?.defaultAudioKey)}
        />
      </StatGrid>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Kill switch & defaults">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ca-enabled">charlie_alarm_enabled</Label>
            <Switch id="ca-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="mt-4 grid gap-2">
            <Label htmlFor="ca-reason">Frase na tela de chamada</Label>
            <Input id="ca-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={80} />
          </div>
          <div className="mt-4 grid gap-2">
            <Label>Toque padrão (heróis novos / fallback)</Label>
            <div className="grid gap-2">
              {CHARLIE_RINGTONES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setAudioKey(r.key)}
                  className={cn(
                    "flex items-center justify-between border px-3 py-2 text-left text-sm",
                    audioKey === r.key
                      ? "border-hero bg-hero/10 text-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  <span>{r.label}</span>
                  <span className="font-mono text-[10px] opacity-60">{r.file}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-white/40">
              Assets nativos:{" "}
              <code>android/.../assets/charlie-ringtones/{"{classic|warrior|calm}"}.wav</code>
            </p>
          </div>
          <Button className="mt-4" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
            Salvar
          </Button>
        </Panel>

        <Panel title="Simular ligação (nativo)">
          <p className="text-sm text-white/60">
            Abre a Activity de chamada no APK. No browser só mostra erro — use o app instalado.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => {
              if (!isNativePlatform()) {
                toast.error("Abra o APK para simular a ligação.");
                return;
              }
              void presentCharlieCall({
                mode: "alarm",
                reason,
                audioKey,
                callId: `dashi-${Date.now()}`,
              })
                .then(() => toast.success("Ligação apresentada."))
                .catch((e: Error) => toast.error(e.message));
            }}
          >
            Simular Charlie Call
          </Button>
          <p className="mt-4 text-xs text-white/35">
            MVP Android: full-screen call + AlarmManager exact + STREAM_ALARM. Core-Telecom fica no
            hardening Play.
          </p>
        </Panel>
      </div>

      <Panel title="Últimos eventos" className="mt-4">
        {!data?.recent?.length ? (
          <p className="text-sm text-white/40">Nenhum evento ainda.</p>
        ) : (
          <ul className="space-y-2 text-sm text-white/70">
            {data.recent.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 font-mono text-xs">
                <span>{e.outcome}</span>
                <span>{e.platform}</span>
                <span>{new Date(e.fired_at).toLocaleString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AdminShell>
  );
}
