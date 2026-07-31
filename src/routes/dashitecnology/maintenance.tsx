import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminGetMaintenance, adminSetMaintenance } from "@/lib/maintenance";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  Panel,
} from "@/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { runQueryFn } from "@/lib/safe-query";

export const Route = createFileRoute("/dashitecnology/maintenance")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "maintenance"],
      queryFn: () => runQueryFn(() => adminGetMaintenance(), "Falha ao carregar manutenção."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => (
    <AdminError error={error instanceof Error ? error : new Error(String(error))} />
  ),
  component: MaintenanceAdminPage,
});

function MaintenanceAdminPage() {
  const qc = useQueryClient();
  const saveFn = useServerFn(adminSetMaintenance);

  const { data } = useSuspenseQuery({
    queryKey: ["admin", "maintenance"],
    queryFn: () => runQueryFn(() => adminGetMaintenance(), "Falha ao carregar manutenção."),
  });

  const [enabled, setEnabled] = useState(data.enabled);
  const [title, setTitle] = useState(data.title);
  const [message, setMessage] = useState(data.message);
  const [eta, setEta] = useState(data.eta ?? "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setEnabled(data.enabled);
    setTitle(data.title);
    setMessage(data.message);
    setEta(data.eta ?? "");
    setDirty(false);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          enabled,
          title,
          message,
          eta: eta.trim() || null,
        },
      }),
    onSuccess: (next) => {
      toast.success(next.enabled ? "Modo manutenção ATIVADO." : "Modo manutenção desativado.");
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ["admin", "maintenance"] });
      void qc.invalidateQueries({ queryKey: ["maintenance", "status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell
      title="Manutenção"
      subtitle="Bloqueia o app para usuários comuns e exibe uma página informativa."
      actions={
        <div className="flex items-center gap-3">
          <Link
            to="/maintenance"
            className="text-xs text-white/45 underline-offset-2 hover:text-white/80 hover:underline"
          >
            Pré-visualizar página
          </Link>
          <Button
            type="button"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
            className="bg-[#FC6E20] text-black hover:bg-[#FC6E20]/90"
          >
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Controle">
          <div className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-black/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">Modo manutenção</p>
              <p className="mt-0.5 text-xs text-white/45">
                {enabled
                  ? "App bloqueado para heróis (dashi e /auth liberados)."
                  : "App aberto normalmente."}
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(v) => {
                setEnabled(v);
                setDirty(true);
              }}
            />
          </div>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maint-title" className="text-white/70">
                Título
              </Label>
              <Input
                id="maint-title"
                value={title}
                maxLength={80}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
                className="border-white/15 bg-black/40 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maint-msg" className="text-white/70">
                Mensagem
              </Label>
              <Textarea
                id="maint-msg"
                value={message}
                maxLength={600}
                rows={5}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setDirty(true);
                }}
                className="border-white/15 bg-black/40 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maint-eta" className="text-white/70">
                Previsão (opcional)
              </Label>
              <Input
                id="maint-eta"
                value={eta}
                maxLength={120}
                placeholder="ex.: Voltamos hoje à noite"
                onChange={(e) => {
                  setEta(e.target.value);
                  setDirty(true);
                }}
                className="border-white/15 bg-black/40 text-white"
              />
            </div>
          </div>
        </Panel>

        <Panel title="Como funciona">
          <ul className="space-y-3 text-sm text-white/65">
            <li>
              Com manutenção <span className="text-[#FC6E20]">ligada</span>, qualquer rota do app
              redireciona para <code className="text-white/90">/maintenance</code>.
            </li>
            <li>
              Continuam liberados: <code className="text-white/90">/auth</code>,{" "}
              <code className="text-white/90">/dashitecnology/*</code> e usuários com role{" "}
              <code className="text-white/90">dashi</code>.
            </li>
            <li>
              A progressão no banco não é apagada — só a experiência do herói fica pausada na UI.
            </li>
            {data.updatedAt ? (
              <li className="text-xs text-white/35">
                Última atualização: {new Date(data.updatedAt).toLocaleString("pt-BR")}
              </li>
            ) : null}
          </ul>

          <div
            className={`mt-6 rounded-md border px-4 py-3 text-sm ${
              enabled
                ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            Status atual: <strong>{enabled ? "EM MANUTENÇÃO" : "operacional"}</strong>
          </div>
        </Panel>
      </div>
    </AdminShell>
  );
}
