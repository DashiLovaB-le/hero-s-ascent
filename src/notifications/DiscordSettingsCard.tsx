import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ExternalLink, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  createDiscordLinkCode,
  getDiscordSettings,
  setDiscordOptIn,
  unlinkDiscord,
} from "@/notifications/discord.functions";

export function DiscordSettingsCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getDiscordSettings);
  const linkFn = useServerFn(createDiscordLinkCode);
  const optFn = useServerFn(setDiscordOptIn);
  const unlinkFn = useServerFn(unlinkDiscord);

  const { data, isLoading } = useQuery({
    queryKey: ["discord-settings"] as const,
    queryFn: () => getFn({ data: undefined as unknown as never }),
    staleTime: 30_000,
  });

  const linkM = useMutation({
    mutationFn: () => linkFn({ data: undefined as unknown as never }),
    onSuccess: async (res) => {
      try {
        await navigator.clipboard.writeText(res.code);
      } catch {
        /* ignore */
      }
      window.open(res.botProfileUrl, "_blank", "noopener,noreferrer");
      toast.message("Código copiado — abra o Charlie no Discord", {
        description: `Use /vincular e cole o código. Expira em 10 min.`,
        duration: 10_000,
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const optM = useMutation({
    mutationFn: (enabled: boolean) => optFn({ data: { enabled } }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["discord-settings"] });
      toast.success(res.enabled ? "Discord ativado" : "Discord pausado");
    },
    onError: (e) => toast.error(e.message),
  });

  const unlinkM = useMutation({
    mutationFn: () => unlinkFn({ data: undefined as unknown as never }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["discord-settings"] });
      toast.success("Discord desconectado");
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
        <h2 className="font-display text-lg font-semibold">Discord</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Receba avisos de hábitos, streak e desafios do Charlie no @{data.botUsername} (DM).
        </p>
      </div>

      {data.linked ? (
        <>
          <p className="text-sm text-hero">Conta vinculada</p>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="dc-opt" className="text-sm text-muted-foreground">
              Enviar notificações no Discord
            </Label>
            <Switch
              id="dc-opt"
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
        <div className="space-y-2">
          <Button
            type="button"
            className="gap-2"
            disabled={linkM.isPending}
            onClick={() => linkM.mutate()}
          >
            <ExternalLink className="h-4 w-4" />
            {linkM.isPending ? "Gerando código…" : "Conectar Discord"}
          </Button>
          {linkM.data?.code ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-surface/40 px-3 py-2 text-xs">
              <code className="flex-1 break-all text-foreground">{linkM.data.code}</code>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1 px-2"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(linkM.data!.code);
                    toast.success("Código copiado");
                  } catch {
                    toast.error("Não foi possível copiar");
                  }
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </Button>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            No Discord, abra o bot e rode{" "}
            <span className="font-mono text-foreground/80">/vincular</span> com o código.
          </p>
        </div>
      )}
    </div>
  );
}
