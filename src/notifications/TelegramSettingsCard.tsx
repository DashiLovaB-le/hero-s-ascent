import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  createTelegramLinkCode,
  getTelegramSettings,
  setTelegramOptIn,
  unlinkTelegram,
} from "@/notifications/telegram.functions";

export function TelegramSettingsCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getTelegramSettings);
  const linkFn = useServerFn(createTelegramLinkCode);
  const optFn = useServerFn(setTelegramOptIn);
  const unlinkFn = useServerFn(unlinkTelegram);

  const { data, isLoading } = useQuery({
    queryKey: ["telegram-settings"] as const,
    queryFn: () => getFn({ data: undefined as unknown as never }),
    staleTime: 30_000,
  });

  const linkM = useMutation({
    mutationFn: () => linkFn({ data: undefined as unknown as never }),
    onSuccess: (res) => {
      window.open(res.deepLink, "_blank", "noopener,noreferrer");
      toast.message("Abra o Telegram e toque em Iniciar", {
        description: "O link expira em 10 minutos.",
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const optM = useMutation({
    mutationFn: (enabled: boolean) => optFn({ data: { enabled } }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["telegram-settings"] });
      toast.success(res.enabled ? "Telegram ativado" : "Telegram pausado");
    },
    onError: (e) => toast.error(e.message),
  });

  const unlinkM = useMutation({
    mutationFn: () => unlinkFn({ data: undefined as unknown as never }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["telegram-settings"] });
      toast.success("Telegram desconectado");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-40 bg-surface" />
        <div className="h-10 bg-surface" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Telegram</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Receba avisos de hábitos, streak e desafios do Charlie no @{data.botUsername}.
        </p>
      </div>

      {data.linked ? (
        <>
          <p className="text-sm text-hero">Conta vinculada</p>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="tg-opt" className="text-sm text-muted-foreground">
              Enviar notificações no Telegram
            </Label>
            <Switch
              id="tg-opt"
              checked={data.optIn}
              disabled={optM.isPending}
              onCheckedChange={(v) => optM.mutate(v)}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground"
            disabled={unlinkM.isPending}
            onClick={() => unlinkM.mutate()}
          >
            <Unplug className="h-4 w-4" />
            Desconectar
          </Button>
        </>
      ) : (
        <Button
          type="button"
          className="gap-2"
          disabled={linkM.isPending}
          onClick={() => linkM.mutate()}
        >
          <ExternalLink className="h-4 w-4" />
          {linkM.isPending ? "Gerando link…" : "Conectar Telegram"}
        </Button>
      )}
    </div>
  );
}
