import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  getNotificationSettings,
  getVapidPublicKeyFn,
  removePushSubscription,
  savePushSubscription,
  upsertNotificationSettings,
} from "@/notifications/push.functions";
import {
  clientVapidPublicKeyFromEnv,
  getPushEnvironmentIssue,
  isWebPushSupported,
  subscribeBrowserPush,
  subscriptionToKeys,
  unsubscribeBrowserPush,
} from "@/notifications/push-client";

export function PushSettingsCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getNotificationSettings);
  const vapidFn = useServerFn(getVapidPublicKeyFn);
  const upsertFn = useServerFn(upsertNotificationSettings);
  const saveSubFn = useServerFn(savePushSubscription);
  const removeSubFn = useServerFn(removePushSubscription);

  const supported = typeof window !== "undefined" && isWebPushSupported();
  const envIssue = typeof window !== "undefined" ? getPushEnvironmentIssue() : null;
  const isProdHttps =
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname);

  const { data, isLoading } = useQuery({
    queryKey: ["notification-settings"] as const,
    queryFn: () => getFn({ data: undefined as unknown as never }),
    staleTime: 30_000,
  });

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ["notification-settings"] });

  const enablePush = useMutation({
    mutationFn: async () => {
      if (envIssue) throw new Error(envIssue);
      if (!supported) {
        throw new Error("Seu navegador não suporta Web Push.");
      }

      const fromServer = await vapidFn({ data: undefined as unknown as never });
      const publicKey =
        (fromServer.valid ? fromServer.publicKey : null) || clientVapidPublicKeyFromEnv();

      if (!publicKey) {
        throw new Error(
          fromServer.keyLength === 0
            ? "Push não configurado no servidor. Defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no Vercel (Production) e redeploy."
            : `Chave VAPID inválida no servidor (len=${fromServer.keyLength}, bytes=${fromServer.byteLength}). Gere um par novo com npx web-push generate-vapid-keys e atualize as duas vars.`,
        );
      }

      const sub = await subscribeBrowserPush(publicKey);
      const keys = subscriptionToKeys(sub);
      await saveSubFn({ data: keys });
      return { ok: true as const };
    },
    onSuccess: () => {
      invalidate();
      toast.success("Notificações push ativadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disablePush = useMutation({
    mutationFn: async () => {
      const endpoint = await unsubscribeBrowserPush();
      if (endpoint) {
        await removeSubFn({ data: { endpoint } });
      } else {
        await removeSubFn({ data: { all: true } });
      }
      await upsertFn({ data: { push_enabled: false } });
      return { ok: true as const };
    },
    onSuccess: () => {
      invalidate();
      toast.success("Notificações push desativadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchSettings = useMutation({
    mutationFn: (patch: {
      notify_habit_reminder?: boolean;
      notify_streak_risk?: boolean;
      notify_mentor?: boolean;
      notify_achievement?: boolean;
      notify_agent?: boolean;
    }) => upsertFn({ data: patch }),
    onSuccess: () => {
      invalidate();
      toast.success("Preferências salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-40 bg-surface" />
        <div className="h-10 bg-surface" />
      </div>
    );
  }

  const s = data.settings;
  const pushOn = Boolean(s.push_enabled && data.subscriptionCount > 0);
  const busy = enablePush.isPending || disablePush.isPending || patchSettings.isPending;
  const vapidOk = data.vapid?.valid ?? data.vapidConfigured;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Notificações push</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Avisos no navegador (hábitos, streak, Charlie). Opt-in explícito — você controla e pode
          desligar quando quiser. Os dados ficam na sua conta.
        </p>
      </div>

      {envIssue ? (
        <p className="text-sm text-amber-200/80">{envIssue}</p>
      ) : !supported ? (
        <p className="text-sm text-amber-200/80">
          Este navegador não suporta Web Push. Use Chrome ou Edge (no Brave, ative Google services
          for push messaging).
        </p>
      ) : !vapidOk ? (
        <p className="text-sm text-amber-200/80">
          Chave VAPID ausente ou inválida no servidor. No Vercel:{" "}
          <code className="text-hero">VAPID_PUBLIC_KEY</code> +{" "}
          <code className="text-hero">VAPID_PRIVATE_KEY</code> (mesmo par) em Production, depois
          Redeploy.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {pushOn ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => disablePush.mutate()}
              className="gap-2"
            >
              <BellOff className="h-4 w-4" />
              {disablePush.isPending ? "Desativando…" : "Desativar push"}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={busy}
              onClick={() => enablePush.mutate()}
              className="gap-2 bg-hero text-black hover:bg-hero/90"
            >
              <BellRing className="h-4 w-4" />
              {enablePush.isPending ? "Ativando…" : "Ativar push neste dispositivo"}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            {data.subscriptionCount} dispositivo(s) registrado(s)
          </p>
        </div>
      )}

      {!isProdHttps ? (
        <p className="text-xs text-muted-foreground">
          Local: use <code className="text-hero">http://localhost:8080</code> (não o IP da rede).
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Produção HTTPS pronta para push. Prefer Chrome/Edge; no Brave ative Google services for
          push messaging.
        </p>
      )}

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Tipos</p>
        {(
          [
            ["notify_habit_reminder", "Lembrete de hábitos"],
            ["notify_streak_risk", "Risco de streak"],
            ["notify_mentor", "Charlie (desafios)"],
            ["notify_achievement", "Conquistas / wallpapers"],
            ["notify_agent", "Iniciativas do agente"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <Label htmlFor={key} className="text-sm text-muted-foreground">
              {label}
            </Label>
            <Switch
              id={key}
              checked={Boolean(s[key])}
              disabled={busy}
              onCheckedChange={(checked) => patchSettings.mutate({ [key]: checked })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
