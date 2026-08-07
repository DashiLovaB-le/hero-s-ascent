import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  AdminTable,
  Panel,
  StatCard,
  StatGrid,
} from "@/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { runQueryFn } from "@/lib/safe-query";
import {
  adminListWisdomCards,
  adminPreviewWisdomPick,
  adminSeedWisdomCards,
  adminToggleWisdomCard,
  adminUpsertWisdomCard,
  type WisdomCardRow,
} from "@/lib/wisdom.functions";
import { WISDOM_SOURCE_LABEL, type WisdomSource } from "@/mentor/wisdom.seed";

export const Route = createFileRoute("/dashitecnology/wisdom")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "wisdom"],
      queryFn: () => runQueryFn(() => adminListWisdomCards(), "Falha sabedoria."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => (
    <AdminError error={error instanceof Error ? error : new Error(String(error))} />
  ),
  component: WisdomAdminPage,
});

function WisdomAdminPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListWisdomCards);
  const seedFn = useServerFn(adminSeedWisdomCards);
  const toggleFn = useServerFn(adminToggleWisdomCard);
  const upsertFn = useServerFn(adminUpsertWisdomCard);
  const previewFn = useServerFn(adminPreviewWisdomPick);

  const { data } = useSuspenseQuery({
    queryKey: ["admin", "wisdom"],
    queryFn: () => runQueryFn(() => listFn(), "Falha sabedoria."),
  });

  const [filter, setFilter] = useState<string>("all");
  const [previewMsg, setPreviewMsg] = useState(
    "Quebrei o streak de novo e tô com vergonha de voltar.",
  );
  const [previewOut, setPreviewOut] = useState<string>("");

  const [edit, setEdit] = useState<WisdomCardRow | null>(null);

  const cards = useMemo(() => {
    if (filter === "all") return data.cards;
    return data.cards.filter((c) => c.source === filter);
  }, [data.cards, filter]);

  const activeCount = data.cards.filter((c) => c.ativo).length;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "wisdom"] });

  const seed = useMutation({
    mutationFn: (forceOverwrite: boolean) => seedFn({ data: { forceOverwrite } }),
    onSuccess: (r) => {
      toast.success(`Seed: ${r.upserted} fichas`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (p: { id: string; ativo: boolean }) => toggleFn({ data: p }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: () => {
      if (!edit) throw new Error("Nada para salvar");
      return upsertFn({
        data: {
          id: edit.id,
          slug: edit.slug,
          source: edit.source as WisdomSource,
          titulo: edit.titulo,
          principio: edit.principio,
          quando_usar: edit.quando_usar,
          quando_evitar: edit.quando_evitar,
          tags: edit.tags,
          keywords: edit.keywords,
          blocked_personalities: edit.blocked_personalities,
          priority: edit.priority,
          ativo: edit.ativo,
        },
      });
    },
    onSuccess: () => {
      toast.success("Ficha salva");
      setEdit(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const preview = useMutation({
    mutationFn: () =>
      previewFn({ data: { message: previewMsg, personalitySlug: "classico" } }),
    onSuccess: (r) => {
      setPreviewOut(
        r.picked.map((p) => `• ${p.titulo} (${p.source})`).join("\n") +
          "\n\n" +
          r.block,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell
      title="Sabedoria"
      subtitle="Fichas curadas para o Charlie (5 fontes). Retrieval por tags/keywords."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 bg-transparent text-white"
            disabled={seed.isPending}
            onClick={() => seed.mutate(false)}
          >
            Seed faltantes
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 bg-transparent text-white"
            disabled={seed.isPending}
            onClick={() => {
              if (confirm("Sobrescrever todas as fichas do seed?")) seed.mutate(true);
            }}
          >
            Reset seed
          </Button>
        </div>
      }
    >
      <StatGrid>
        <StatCard label="Fichas" value={data.cards.length} hint={`seed ${data.seedCount}`} />
        <StatCard label="Ativas" value={activeCount} />
        <StatCard label="Fontes" value={Object.keys(WISDOM_SOURCE_LABEL).length} />
      </StatGrid>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          className={filter === "all" ? "" : "border-white/20 bg-transparent text-white"}
          onClick={() => setFilter("all")}
        >
          Todas
        </Button>
        {(Object.keys(WISDOM_SOURCE_LABEL) as WisdomSource[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            className={filter === s ? "" : "border-white/20 bg-transparent text-white"}
            onClick={() => setFilter(s)}
          >
            {WISDOM_SOURCE_LABEL[s].split(" (")[0]}
          </Button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Fichas">
          <AdminTable headers={["Ativa", "Título", "Fonte", "Pri", ""]}>
            {cards.map((c) => (
              <tr key={c.id}>
                <td className="px-2 py-2">
                  <Switch
                    checked={c.ativo}
                    onCheckedChange={(v) => toggle.mutate({ id: c.id, ativo: v })}
                  />
                </td>
                <td className="px-2 py-2 text-white/90">{c.titulo}</td>
                <td className="px-2 py-2 text-xs text-white/45">
                  {WISDOM_SOURCE_LABEL[c.source as WisdomSource] ?? c.source}
                </td>
                <td className="px-2 py-2 text-white/60">{c.priority}</td>
                <td className="px-2 py-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[#FC6E20]"
                    onClick={() => setEdit({ ...c })}
                  >
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </AdminTable>
        </Panel>

        <div className="space-y-4">
          <Panel title="Testar retrieval">
            <Label className="text-white/60">Mensagem do herói</Label>
            <Textarea
              className="mt-1 border-white/15 bg-black/40 text-white"
              value={previewMsg}
              onChange={(e) => setPreviewMsg(e.target.value)}
              rows={3}
            />
            <Button
              className="mt-3"
              size="sm"
              disabled={preview.isPending}
              onClick={() => preview.mutate()}
            >
              Pré-visualizar
            </Button>
            {previewOut ? (
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/50 p-3 text-xs text-white/70">
                {previewOut}
              </pre>
            ) : null}
          </Panel>

          {edit ? (
            <Panel title={`Editar: ${edit.titulo}`}>
              <div className="space-y-3">
                <div>
                  <Label className="text-white/60">Título</Label>
                  <Input
                    className="mt-1 border-white/15 bg-black/40 text-white"
                    value={edit.titulo}
                    onChange={(e) => setEdit({ ...edit, titulo: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-white/60">Princípio</Label>
                  <Textarea
                    className="mt-1 border-white/15 bg-black/40 text-white"
                    rows={4}
                    value={edit.principio}
                    onChange={(e) => setEdit({ ...edit, principio: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-white/60">Quando usar</Label>
                  <Textarea
                    className="mt-1 border-white/15 bg-black/40 text-white"
                    rows={2}
                    value={edit.quando_usar}
                    onChange={(e) => setEdit({ ...edit, quando_usar: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-white/60">Quando evitar</Label>
                  <Textarea
                    className="mt-1 border-white/15 bg-black/40 text-white"
                    rows={2}
                    value={edit.quando_evitar}
                    onChange={(e) => setEdit({ ...edit, quando_evitar: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-white/60">Prioridade</Label>
                  <Input
                    type="number"
                    className="mt-1 border-white/15 bg-black/40 text-white"
                    value={edit.priority}
                    onChange={(e) =>
                      setEdit({ ...edit, priority: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
                    Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 bg-transparent text-white"
                    onClick={() => setEdit(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
