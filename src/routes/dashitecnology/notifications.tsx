import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { adminBroadcastNotification, adminNotificationsOverview } from "@/admin/functions";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  AdminTable,
  Panel,
  StatCard,
  StatGrid,
  shortId,
} from "@/admin/ui";
import { runQueryFn } from "@/lib/safe-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/dashitecnology/notifications")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "notifications"],
      queryFn: () => runQueryFn(() => adminNotificationsOverview(), "Falha notificações."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => (
    <AdminError error={error instanceof Error ? error : new Error(String(error))} />
  ),
  component: NotificationsAdminPage,
});

type Audience = "all" | "onboarding_done";

function NotificationsAdminPage() {
  const qc = useQueryClient();
  const broadcastFn = useServerFn(adminBroadcastNotification);

  const { data } = useSuspenseQuery({
    queryKey: ["admin", "notifications"],
    queryFn: () => runQueryFn(() => adminNotificationsOverview(), "Falha notificações."),
  });

  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [href, setHref] = useState("/journey");
  const [audience, setAudience] = useState<Audience>("onboarding_done");
  const [confirmText, setConfirmText] = useState("");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{
    sent: number;
    failed: number;
    recipients: number;
  } | null>(null);

  const preview = useMutation({
    mutationFn: () =>
      broadcastFn({
        data: {
          titulo: titulo.trim() || "Prévia",
          corpo: corpo.trim() || null,
          href: href.trim() || "/journey",
          audience,
          dryRun: true,
        },
      }),
    onSuccess: (res) => {
      setPreviewCount(res.recipients);
      toast.success(`${res.recipients} destinatário(s) neste público.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: () =>
      broadcastFn({
        data: {
          titulo: titulo.trim(),
          corpo: corpo.trim() || null,
          href: href.trim() || "/journey",
          audience,
          dryRun: false,
          confirm: confirmText.trim(),
        },
      }),
    onSuccess: (res) => {
      setLastResult({ sent: res.sent, failed: res.failed, recipients: res.recipients });
      setConfirmText("");
      void qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
      if (res.failed > 0) {
        toast.error(`Enviado ${res.sent}/${res.recipients}. Falhas: ${res.failed}.`);
      } else {
        toast.success(`Broadcast enviado para ${res.sent} herói(s).`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = preview.isPending || send.isPending;

  return (
    <AdminShell
      title="Notificações"
      subtitle="Inbox recente + broadcast para heróis (in-app, push e Telegram opt-in)."
    >
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Broadcast">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!titulo.trim()) {
                toast.error("Informe o título.");
                return;
              }
              if (confirmText.trim() !== "ENVIAR") {
                toast.error('Digite ENVIAR no campo de confirmação.');
                return;
              }
              if (
                !window.confirm(
                  `Enviar para ${previewCount ?? "todos os"} destinatário(s) do público selecionado?`,
                )
              ) {
                return;
              }
              send.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={120}
                placeholder="Novidade no V-Project"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Corpo</Label>
              <Textarea
                value={corpo}
                onChange={(e) => setCorpo(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Texto da notificação…"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Link interno (tap / abrir)</Label>
                <Input
                  value={href}
                  onChange={(e) => setHref(e.target.value)}
                  maxLength={200}
                  placeholder="/journey"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Público</Label>
                <Select
                  value={audience}
                  onValueChange={(v) => {
                    setAudience(v as Audience);
                    setPreviewCount(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onboarding_done">Só onboarding completo</SelectItem>
                    <SelectItem value="all">Todos os perfis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs text-white/45">
              Tipo <code className="text-white/70">system</code>. Cria na inbox e tenta Web Push /
              push nativo / Telegram conforme opt-in de cada herói.
            </p>

            <div className="space-y-1.5">
              <Label>Confirmação — digite ENVIAR</Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="ENVIAR"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="border-white/20 text-white"
                disabled={busy}
                onClick={() => preview.mutate()}
              >
                {preview.isPending ? "Contando…" : "Contar destinatários"}
              </Button>
              <Button
                type="submit"
                disabled={busy || !titulo.trim()}
                className="bg-[#FC6E20] text-black hover:bg-[#FC6E20]/90"
              >
                {send.isPending ? "Enviando…" : "Disparar broadcast"}
              </Button>
            </div>

            {(previewCount != null || lastResult) && (
              <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/60">
                {previewCount != null ? (
                  <p>
                    Prévia: <span className="text-white">{previewCount}</span> destinatário(s).
                  </p>
                ) : null}
                {lastResult ? (
                  <p className="mt-1">
                    Último envio:{" "}
                    <span className="text-emerald-400">{lastResult.sent}</span> ok ·{" "}
                    <span className="text-red-400">{lastResult.failed}</span> falha ·{" "}
                    {lastResult.recipients} no público.
                  </p>
                ) : null}
              </div>
            )}
          </form>
        </Panel>

        <div className="space-y-4">
          <StatGrid>
            <StatCard label="Listadas" value={data.notifications.length} />
            <StatCard label="Não lidas (amostra)" value={data.unread} />
            <StatCard
              label="Tipos"
              value={Object.keys(data.byTipo).length}
              hint={Object.entries(data.byTipo)
                .map(([k, v]) => `${k}:${v}`)
                .join(" · ")}
            />
          </StatGrid>
        </div>
      </div>

      <Panel title="Inbox recente (últimas 150)" className="mt-6">
        <AdminTable headers={["Tipo", "Título", "User", "Lida", "Quando"]}>
          {data.notifications.map((n) => (
            <tr key={n.id} className="text-white/75">
              <td className="px-2 py-1.5">{n.tipo}</td>
              <td className="px-2 py-1.5">{n.titulo}</td>
              <td className="px-2 py-1.5 text-xs">{shortId(n.user_id)}</td>
              <td className="px-2 py-1.5">{n.lido_em ? "sim" : "não"}</td>
              <td className="px-2 py-1.5 text-xs">{n.created_at.slice(0, 16)}</td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </AdminShell>
  );
}
