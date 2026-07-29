import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminDeleteWallpaper,
  adminListWallpapers,
  adminUploadWallpaperImage,
  adminUpsertWallpaper,
} from "@/admin/catalog.functions";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  AdminTable,
  Panel,
} from "@/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runQueryFn } from "@/lib/safe-query";

export const Route = createFileRoute("/dashitecnology/wallpapers")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "wallpapers"],
      queryFn: () => runQueryFn(() => adminListWallpapers(), "Falha wallpapers."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => (
    <AdminError error={error instanceof Error ? error : new Error(String(error))} />
  ),
  component: WallpapersAdminPage,
});

type UnlockKind = "always" | "level" | "streak_max" | "chapter" | "xp";

function WallpapersAdminPage() {
  const qc = useQueryClient();
  const listKey = ["admin", "wallpapers"] as const;
  const upsertFn = useServerFn(adminUpsertWallpaper);
  const delFn = useServerFn(adminDeleteWallpaper);
  const uploadFn = useServerFn(adminUploadWallpaperImage);

  const { data } = useSuspenseQuery({
    queryKey: listKey,
    queryFn: () => runQueryFn(() => adminListWallpapers(), "Falha wallpapers."),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: listKey });

  const [form, setForm] = useState({
    id: "",
    titulo: "",
    descricao: "",
    file_name: "",
    image_url: "",
    unlock_kind: "level" as UnlockKind,
    unlock_min: "2",
    sort_order: "200",
    ativo: true,
  });

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: form.id.trim(),
          titulo: form.titulo.trim(),
          descricao: form.descricao.trim(),
          file_name: form.file_name.trim() || null,
          image_url: form.image_url.trim() || null,
          unlock_kind: form.unlock_kind,
          unlock_min: Number(form.unlock_min) || 0,
          sort_order: Number(form.sort_order) || 0,
          ativo: form.ativo,
        },
      }),
    onSuccess: () => {
      toast.success("Wallpaper salvo");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Excluído");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
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
          wallpaperId: id,
          fileName: file.name,
          contentType,
          base64,
        },
      });
    },
    onSuccess: () => {
      toast.success("Imagem enviada");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell
      title="Wallpapers"
      subtitle="Fundos desbloqueáveis por nível, streak, capítulo ou XP."
    >
      <Panel title="Catálogo">
        <AdminTable headers={["Preview", "ID", "Título", "Unlock", "Ativo", "Ações"]}>
          {data.wallpapers.map((w) => {
            const src = w.image_url || (w.file_name ? `/wallpapers/${w.file_name}` : null);
            return (
              <tr key={w.id} className="text-white/75">
                <td className="px-2 py-2">
                  {src ? (
                    <img src={src} alt="" className="h-12 w-20 object-cover" />
                  ) : (
                    <span className="text-xs text-white/30">—</span>
                  )}
                </td>
                <td className="px-2 py-2 font-mono text-xs">{w.id}</td>
                <td className="px-2 py-2">{w.titulo}</td>
                <td className="px-2 py-2 text-xs">
                  {w.unlock_kind}
                  {w.unlock_kind !== "always" ? ` ≥${w.unlock_min}` : ""}
                </td>
                <td className="px-2 py-2">{w.ativo ? "sim" : "não"}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer text-xs text-[#FC6E20] hover:underline">
                      Upload
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) upload.mutate({ id: w.id, file: f });
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="text-xs text-white/50 hover:text-white"
                      onClick={() =>
                        setForm({
                          id: w.id,
                          titulo: w.titulo,
                          descricao: w.descricao,
                          file_name: w.file_name ?? "",
                          image_url: w.image_url ?? "",
                          unlock_kind: w.unlock_kind as UnlockKind,
                          unlock_min: String(w.unlock_min),
                          sort_order: String(w.sort_order),
                          ativo: w.ativo,
                        })
                      }
                    >
                      Editar
                    </button>
                    {w.id !== "none" ? (
                      <button
                        type="button"
                        className="text-xs text-red-300 hover:underline"
                        onClick={() => remove.mutate(w.id)}
                      >
                        Excluir
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </AdminTable>
      </Panel>

      <Panel className="mt-4" title="Criar / editar">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="ID" value={form.id} onChange={(v) => setForm({ ...form, id: v })} />
          <Field
            label="Título"
            value={form.titulo}
            onChange={(v) => setForm({ ...form, titulo: v })}
          />
          <Field
            label="Arquivo public/ (opcional)"
            value={form.file_name}
            onChange={(v) => setForm({ ...form, file_name: v })}
          />
          <Field
            label="URL imagem (opcional)"
            value={form.image_url}
            onChange={(v) => setForm({ ...form, image_url: v })}
          />
          <label className="text-xs text-white/50">
            Unlock
            <select
              className="mt-1 w-full border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              value={form.unlock_kind}
              onChange={(e) =>
                setForm({ ...form, unlock_kind: e.target.value as UnlockKind })
              }
            >
              <option value="always">always</option>
              <option value="level">level</option>
              <option value="streak_max">streak_max</option>
              <option value="chapter">chapter</option>
              <option value="xp">xp</option>
            </select>
          </label>
          <Field
            label="Unlock min"
            value={form.unlock_min}
            onChange={(v) => setForm({ ...form, unlock_min: v })}
          />
          <Field
            label="Sort"
            value={form.sort_order}
            onChange={(v) => setForm({ ...form, sort_order: v })}
          />
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            Ativo
          </label>
        </div>
        <label className="mt-3 block text-xs text-white/50">
          Descrição
          <Input
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="mt-1 border-white/10 bg-black/30"
          />
        </label>
        <Button className="mt-4" disabled={save.isPending} onClick={() => save.mutate()}>
          Salvar wallpaper
        </Button>
      </Panel>
    </AdminShell>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-xs text-white/50">
      {label}
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 border-white/10 bg-black/30"
      />
    </label>
  );
}
