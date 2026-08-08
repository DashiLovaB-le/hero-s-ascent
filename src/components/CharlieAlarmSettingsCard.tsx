import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlarmClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { isNativePlatform } from "@/lib/platform";
import { getCharlieAlarm, upsertCharlieAlarm } from "@/lib/charlie-call/functions";
import {
  canScheduleCharlieExact,
  cancelCharlieAlarm,
  nextAlarmTriggerMs,
  openCharlieExactAlarmSettings,
  persistCharlieBootSchedule,
  scheduleCharlieAlarm,
} from "@/lib/charlie-call/client";

const DAY_LABELS = [
  { d: 0, label: "D" },
  { d: 1, label: "S" },
  { d: 2, label: "T" },
  { d: 3, label: "Q" },
  { d: 4, label: "Q" },
  { d: 5, label: "S" },
  { d: 6, label: "S" },
] as const;

export function CharlieAlarmSettingsCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getCharlieAlarm);
  const upsertFn = useServerFn(upsertCharlieAlarm);
  const [native, setNative] = useState(false);

  useEffect(() => {
    setNative(isNativePlatform());
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["charlie-alarm"] as const,
    queryFn: () => getFn(),
    staleTime: 15_000,
  });

  const [enabled, setEnabled] = useState(false);
  const [timeLocal, setTimeLocal] = useState("06:30");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    if (!data?.alarm) return;
    setEnabled(data.alarm.enabled);
    setTimeLocal(data.alarm.time_local.slice(0, 5));
    setDays(data.alarm.days_of_week?.length ? data.alarm.days_of_week : [1, 2, 3, 4, 5]);
  }, [data]);

  const globalOn = data?.globalEnabled !== false;

  const saveMut = useMutation({
    mutationFn: async () => {
      const row = await upsertFn({
        data: {
          enabled,
          time_local: timeLocal,
          days_of_week: days,
          snooze_minutes: 5,
          audio_key: "classico",
          reason_text: "Hora de subir",
        },
      });

      if (isNativePlatform()) {
        await cancelCharlieAlarm(77001);
        if (row.enabled && globalOn) {
          const exact = await canScheduleCharlieExact();
          if (!exact.allowed) {
            toast.message("Permita alarmes exatos nas configurações do Android.");
            await openCharlieExactAlarmSettings();
          }
          const triggerAtMs = nextAlarmTriggerMs({
            timeLocal: row.time_local.slice(0, 5),
            daysOfWeek: row.days_of_week,
          });
          const sched = await scheduleCharlieAlarm({
            triggerAtMs,
            callId: `alarm-${row.id}`,
            reason: row.reason_text,
            audioKey: row.audio_key,
          });
          await persistCharlieBootSchedule({
            enabled: true,
            triggerAtMs,
            callId: `alarm-${row.id}`,
            reason: row.reason_text,
            audioKey: row.audio_key,
          });
          if (sched.needsExactAlarmPermission) {
            toast.message("Ative “Alarmes e lembretes” para o V-Project.");
            await openCharlieExactAlarmSettings();
          }
        } else {
          await persistCharlieBootSchedule({ enabled: false, triggerAtMs: 0 });
        }
      }

      return row;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["charlie-alarm"] });
      toast.success(native ? "Despertador sincronizado no aparelho." : "Preferência salva (dispara só no app nativo).");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nextLabel = useMemo(() => {
    if (!enabled || !globalOn) return null;
    const ms = nextAlarmTriggerMs({ timeLocal, daysOfWeek: days });
    return new Date(ms).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }, [enabled, globalOn, timeLocal, days]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card/40 p-4 text-sm text-muted-foreground">
        Carregando despertador…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlarmClock className="h-4 w-4 text-hero" />
        <h3 className="font-display text-sm font-semibold">Despertador do Charlie</h3>
      </div>

      {!globalOn ? (
        <p className="mb-3 text-xs text-amber-400/90">
          Feature desligada globalmente no control room. Seu horário fica salvo, mas não dispara.
        </p>
      ) : null}

      {!native ? (
        <p className="mb-3 text-xs text-muted-foreground">
          No navegador você só configura. O toque como “ligação” acontece no app Android.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="charlie-alarm-enabled">Ativar</Label>
        <Switch
          id="charlie-alarm-enabled"
          checked={enabled}
          disabled={!globalOn}
          onCheckedChange={setEnabled}
        />
      </div>

      <div className="mt-3 grid gap-2">
        <Label htmlFor="charlie-alarm-time">Horário</Label>
        <Input
          id="charlie-alarm-time"
          type="time"
          value={timeLocal}
          onChange={(e) => setTimeLocal(e.target.value)}
          className="max-w-[10rem]"
        />
      </div>

      <div className="mt-3">
        <Label>Dias</Label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DAY_LABELS.map(({ d, label }) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() =>
                  setDays((prev) =>
                    on ? (prev.length > 1 ? prev.filter((x) => x !== d) : prev) : [...prev, d].sort(),
                  )
                }
                className={
                  on
                    ? "h-8 w-8 rounded-md bg-hero text-xs font-bold text-black"
                    : "h-8 w-8 rounded-md border border-border text-xs text-muted-foreground"
                }
                aria-pressed={on}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {nextLabel ? (
        <p className="mt-3 text-xs text-muted-foreground">Próximo (estimado): {nextLabel}</p>
      ) : null}

      <Button
        className="mt-4"
        size="sm"
        disabled={saveMut.isPending}
        onClick={() => saveMut.mutate()}
      >
        {saveMut.isPending ? "Salvando…" : "Salvar despertador"}
      </Button>
    </div>
  );
}
