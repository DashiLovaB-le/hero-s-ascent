import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { createGoal, deleteGoal } from "@/lib/journey.functions";
import { goalsQueryOptions } from "@/lib/journey-queries";
import { CATEGORIAS } from "@/lib/journey";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/goals")({
  loader: ({ context }) => context.queryClient.ensureQueryData(goalsQueryOptions()),
  errorComponent: ({ error }) => (
    <div className="p-6 text-destructive">
      {error instanceof Error ? error.message : String(error ?? "Falha ao carregar metas")}
    </div>
  ),
  notFoundComponent: () => <div>Não encontrado</div>,
  component: GoalsPage,
});

type Cat = "corpo" | "mente" | "espirito" | "prosperidade" | "relacionamentos" | "proposito";
type GoalRow = Awaited<ReturnType<typeof import("@/lib/journey.functions").listGoals>>[number];
interface DraftGoal { categoria: Cat; titulo: string; key: string }

function GoalsPage() {
  const createFn = useServerFn(createGoal);
  const deleteFn = useServerFn(deleteGoal);
  const qc = useQueryClient();
  const { data: goals } = useSuspenseQuery(goalsQueryOptions());

  const [draft, setDraft] = useState<DraftGoal[]>([]);
  const [cat, setCat] = useState<Cat>("corpo");
  const [titulo, setTitulo] = useState("");

  const createM = useMutation({
    mutationFn: async (items: DraftGoal[]) => {
      const rows: GoalRow[] = [];
      for (const item of items) {
        rows.push(await createFn({ data: { categoria: item.categoria, titulo: item.titulo } }));
      }
      return rows;
    },
    onSuccess: (rows) => {
      toast.success("Metas salvas");
      setDraft([]);
      qc.setQueryData<GoalRow[]>(["goals"], (old) => [...(old ?? []), ...rows]);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["goals"] });
      const prev = qc.getQueryData<GoalRow[]>(["goals"]);
      qc.setQueryData<GoalRow[]>(["goals"], (old) => (old ?? []).filter((g) => g.id !== id));
      return { prev };
    },
    onError: (e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["goals"], ctx.prev);
      toast.error(e.message);
    },
  });

  function addDraft() {
    if (titulo.trim().length < 2) return toast.error("Título muito curto");
    setDraft((d) => [...d, { categoria: cat, titulo: titulo.trim(), key: crypto.randomUUID() }]);
    setTitulo("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Metas</h1>
        <p className="text-sm text-muted-foreground">O norte da sua jornada. Escolha poucas — foque em muito.</p>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 font-display font-semibold">Adicionar meta</h2>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
          <Select value={cat} onValueChange={(v) => setCat(v as Cat)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.emoji} {c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Ex: Perder 8kg em 3 meses" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} />
          <Button onClick={addDraft} type="button"><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
        </div>
        {draft.length > 0 && (
          <div className="mt-4 flex justify-end">
            <Button onClick={() => createM.mutate(draft)} disabled={createM.isPending}>
              Salvar {draft.length} nova(s)
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 font-display font-semibold">Suas metas</h2>
        {goals.length === 0 && draft.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma meta ainda.</p>
        ) : (
          <ul className="space-y-2">
            {goals.map((g) => {
              const c = CATEGORIAS.find((x) => x.id === g.categoria);
              return (
                <li key={g.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{c?.emoji}</span>
                    <div>
                      <p className="text-sm font-medium">{g.titulo}</p>
                      <p className="text-xs text-muted-foreground">{c?.nome}</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteM.mutate(g.id)} aria-label="Remover">
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
            {draft.map((g) => {
              const c = CATEGORIAS.find((x) => x.id === g.categoria);
              return (
                <li key={g.key} className="flex items-center justify-between rounded-lg border border-dashed border-border bg-surface/50 p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{c?.emoji}</span>
                    <div>
                      <p className="text-sm font-medium">{g.titulo}</p>
                      <p className="text-xs text-muted-foreground">{c?.nome} · rascunho</p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDraft((d) => d.filter((x) => x.key !== g.key))}
                    aria-label="Remover"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
