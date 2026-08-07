import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminError, AdminLoading, AdminShell, Panel } from "@/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { runQueryFn } from "@/lib/safe-query";
import {
  adminDeletePopup,
  adminListPopups,
  adminUploadPopupImage,
  adminUpsertPopup,
  POPUP_TARGET_OPTIONS,
  type AppPopupRow,
} from "@/lib/popup.functions";

export const Route = createFileRoute("/dashitecnology/popups")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "popups"],
      queryFn: () => runQueryFn(() => adminListPopups(), "Falha ao carregar pop-ups."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => (
    <AdminError error={error instanceof Error ? error : new Error(String(error))} />
  ),
  component: PopupsAdminPage,
});

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) throw new Error("Data inválida.");
  return d.toISOString();
}

function emptyForm() {
  const start = new Date();
  const end = new Date(Date.now() + 7 * 86400000);
  return {
    id: undefined as string | undefined,
    titulo: "",
    subtitulo: "",
    corpo: "",
    image_url: "",
    button_label: "Entendi",
    target_path: "/journey" as (typeof POPUP_TARGET_OPTIONS)[number]["value"],
    ativo: false,
    starts_at: toLocalInput(start.toISOString()),
    expires_at: toLocalInput(end.toISOString()),
    priority: 0,
  };
}

function PopupsAdminPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListPopups);
  const upsertFn = useServerFn(adminUpsertPopup);
  const deleteFn = useServerFn(adminDeletePopup);
  const uploadFn = useServerFn(adminUploadPopupImage);

  const { data } = useSuspenseQuery({
    queryKey: ["admin", "popups"],
    queryFn: () => runQueryFn(() => listFn(), "Falha ao carregar pop-ups."),
  });

  const [form, setForm] = useState(emptyForm);

  const now = Date.now();
  const items = useMemo(() => data.items ?? [], [data.items]);

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: form.id,
          titulo: form.titulo,
          subtitulo: form.subtitulo || null,
          corpo: form.corpo,
          image_url: form.image_url || null,
          button_label: form.button_label || "Entendi",
          target_path: form.target_path,
          ativo: form.ativo,
          starts_at: fromLocalInput(form.starts_at),
          expires_at: fromLocalInput(form.expires_at),
          priority: form.priority,
        },
      }),
    onSuccess: () => {
      toast.success(form.id ? "Pop-up atualizado." : "Pop-up criado.");
      setForm(emptyForm());
      void qc.invalidateQueries({ queryKey: ["admin", "popups"] });
      void qc.invalidateQueries({ queryKey: ["app-popup"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Pop-up excluído.");
      void qc.invalidateQueries({ queryKey: ["admin", "popups"] });
      void qc.invalidateQueries({ queryKey: ["app-popup"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
      const base64 = btoa(binary);
      const contentType = (
        file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif"
          ? file.type
          : "image/jpeg"
      ) as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
      return uploadFn({
        data: {
          fileName: file.name,
          contentType,
          base64,
        },
      });
    },
    onSuccess: (res) => {
      setForm((f) => ({ ...f, image_url: res.imageUrl }));
      toast.success("Imagem enviada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function loadItem(item: AppPopupRow) {
    setForm({
      id: item.id,
      titulo: item.titulo,
      subtitulo: item.subtitulo ?? "",
      corpo: item.corpo,
      image_url: item.image_url ?? "",
      button_label: item.button_label || "Entendi",
      target_path: item.target_path as (typeof POPUP_TARGET_OPTIONS)[number]["value"],
      ativo: item.ativo,
      starts_at: toLocalInput(item.starts_at),
      expires_at: toLocalInput(item.expires_at),
      priority: item.priority,
    });
  }

  return (
    <AdminShell
      title="Pop-ups"
      subtitle="Anúncios temporários por página — fora das notificações. Abrem ao carregar a rota."
      actions={
        <Button
          type="button"
          variant="outline"
          className="border-white/20 text-white"
          onClick={() => setForm(emptyForm())}
        >
          Novo
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Panel title={form.id ? "Editar pop-up" : "Criar pop-up"}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subtítulo</Label>
              <Input
                value={form.subtitulo}
                onChange={(e) => setForm((f) => ({ ...f, subtitulo: e.target.value }))}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Texto *</Label>
              <Textarea
                value={form.corpo}
                onChange={(e) => setForm((f) => ({ ...f, corpo: e.target.value }))}
                rows={4}
                maxLength={4000}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Imagem (URL)</Label>
              <Input
                value={form.image_url}
                onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                placeholder="https://… ou faça upload"
              />
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="cursor-pointer text-xs text-white/60"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload.mutate(f);
                }}
              />
              {form.image_url ? (
                <img
                  src={form.image_url}
                  alt=""
                  className="mt-2 max-h-32 rounded border border-white/10 object-cover"
                />
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Texto do botão</Label>
                <Input
                  value={form.button_label}
                  onChange={(e) => setForm((f) => ({ ...f, button_label: e.target.value }))}
                  maxLength={40}
                  placeholder="Entendi / Fechar"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Página alvo *</Label>
                <Select
                  value={form.target_path}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      target_path: v as (typeof POPUP_TARGET_OPTIONS)[number]["value"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POPUP_TARGET_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Início</Label>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expiração *</Label>
                <Input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-black/30 px-4 py-3">
              <div>
                <p className="text-sm text-white">Ativo</p>
                <p className="text-xs text-white/45">Só aparece se ativo e dentro da validade.</p>
              </div>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade (0–100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                disabled={save.isPending || upload.isPending}
                className="bg-[#FC6E20] text-black hover:bg-[#FC6E20]/90"
              >
                {save.isPending ? "Salvando…" : form.id ? "Atualizar" : "Criar"}
              </Button>
              {form.id ? (
                <Button type="button" variant="ghost" onClick={() => setForm(emptyForm())}>
                  Cancelar edição
                </Button>
              ) : null}
            </div>
          </form>
        </Panel>

        <Panel title={`Lista (${items.length})`}>
          {items.length === 0 ? (
            <p className="text-sm text-white/45">Nenhum pop-up ainda.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const expired = new Date(item.expires_at).getTime() <= now;
                const notStarted = new Date(item.starts_at).getTime() > now;
                const live = item.ativo && !expired && !notStarted;
                return (
                  <li key={item.id} className="rounded-md border border-white/10 bg-black/25 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{item.titulo}</p>
                        <p className="mt-0.5 text-xs text-white/45">
                          {item.target_path} · botão “{item.button_label}”
                        </p>
                        <p className="mt-1 text-[11px] text-white/40">
                          {live ? (
                            <span className="text-emerald-400">Ao vivo</span>
                          ) : expired ? (
                            <span className="text-red-400">Expirado</span>
                          ) : notStarted ? (
                            <span className="text-amber-400">Agendado</span>
                          ) : (
                            <span className="text-white/40">Inativo</span>
                          )}
                          {" · "}
                          até {new Date(item.expires_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-white/20 text-xs"
                          onClick={() => loadItem(item)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-xs text-red-400"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (confirm(`Excluir “${item.titulo}”?`)) remove.mutate(item.id);
                          }}
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}
