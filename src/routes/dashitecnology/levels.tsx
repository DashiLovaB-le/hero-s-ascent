import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminDeleteLevel,
  adminListLevels,
  adminResetLevelsSeed,
  adminUpsertLevel,
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

export const Route = createFileRoute("/dashitecnology/levels")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "levels"],
      queryFn: () => runQueryFn(() => adminListLevels(), "Falha níveis."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => (
    <AdminError error={error instanceof Error ? error : new Error(String(error))} />
  ),
  component: LevelsAdminPage,
});

function LevelsAdminPage() {
  const qc = useQueryClient();
  const upsertFn = useServerFn(adminUpsertLevel);
  const delFn = useServerFn(adminDeleteLevel);
  const resetFn = useServerFn(adminResetLevelsSeed);

  const { data } = useSuspenseQuery({
    queryKey: ["admin", "levels"],
    queryFn: () => runQueryFn(() => adminListLevels(), "Falha níveis."),
  });

  const [drafts, setDrafts] = useState<
    Record<number, { titulo: string; xp: string; descricao: string }>
  >({});

  function draft(nivel: number, titulo: string, xp: number, descricao: string | null) {
    return (
      drafts[nivel] ?? {
        titulo,
        xp: String(xp),
        descricao: descricao ?? "",
      }
    );
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "levels"] });

  const save = useMutation({
    mutationFn: (row: { nivel: number; titulo: string; xp_necessario: number; descricao: string }) =>
      upsertFn({
        data: {
          nivel: row.nivel,
          titulo: row.titulo,
          xp_necessario: row.xp_necessario,
          descricao: row.descricao || null,
        },
      }),
    onSuccess: () => {
      toast.success("Nível salvo");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (nivel: number) => delFn({ data: { nivel } }),
    onSuccess: () => {
      toast.success("Nível excluído");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: () => resetFn(),
    onSuccess: (r) => {
      toast.success(`Seed restaurado (${r.count} níveis)`);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newNivel, setNewNivel] = useState("13");
  const [newTitulo, setNewTitulo] = useState("");
  const [newXp, setNewXp] = useState("120000");

  return (
    <AdminShell
      title="Níveis"
      subtitle="XP necessário para cada nível. Alterações valem para a jornada inteira."
      actions={
        <Button variant="outline" disabled={reset.isPending} onClick={() => reset.mutate()}>
          Restaurar seed padrão
        </Button>
      }
    >
      <Panel title="Tabela de níveis">
        <AdminTable headers={["Nível", "Título", "XP necessário", "Descrição", ""]}>
          {data.levels.map((l) => {
            const d = draft(l.nivel, l.titulo, l.xp_necessario, l.descricao);
            return (
              <tr key={l.nivel} className="text-white/80">
                <td className="px-2 py-2 font-mono">{l.nivel}</td>
                <td className="px-2 py-2">
                  <Input
                    value={d.titulo}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [l.nivel]: { ...d, titulo: e.target.value },
                      }))
                    }
                    className="border-white/10 bg-black/30"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    value={d.xp}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [l.nivel]: { ...d, xp: e.target.value },
                      }))
                    }
                    className="max-w-[140px] border-white/10 bg-black/30"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input
                    value={d.descricao}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [l.nivel]: { ...d, descricao: e.target.value },
                      }))
                    }
                    className="border-white/10 bg-black/30"
                  />
                </td>
                <td className="px-2 py-2">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={save.isPending}
                      onClick={() =>
                        save.mutate({
                          nivel: l.nivel,
                          titulo: d.titulo.trim(),
                          xp_necessario: Number(d.xp) || 0,
                          descricao: d.descricao,
                        })
                      }
                    >
                      Salvar
                    </Button>
                    {l.nivel > 1 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(l.nivel)}
                      >
                        Excluir
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </AdminTable>
      </Panel>

      <Panel className="mt-4" title="Incluir nível">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-white/50">
            Nº
            <Input
              value={newNivel}
              onChange={(e) => setNewNivel(e.target.value)}
              className="mt-1 w-20 border-white/10 bg-black/30"
            />
          </label>
          <label className="text-xs text-white/50">
            Título
            <Input
              value={newTitulo}
              onChange={(e) => setNewTitulo(e.target.value)}
              className="mt-1 w-48 border-white/10 bg-black/30"
            />
          </label>
          <label className="text-xs text-white/50">
            XP
            <Input
              value={newXp}
              onChange={(e) => setNewXp(e.target.value)}
              className="mt-1 w-32 border-white/10 bg-black/30"
            />
          </label>
          <Button
            disabled={save.isPending || !newTitulo.trim()}
            onClick={() =>
              save.mutate({
                nivel: Number(newNivel) || 0,
                titulo: newTitulo.trim(),
                xp_necessario: Number(newXp) || 0,
                descricao: "",
              })
            }
          >
            Adicionar
          </Button>
        </div>
      </Panel>
    </AdminShell>
  );
}
