import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { listGoals, setGoals } from "@/lib/journey.functions";
import { CATEGORIAS } from "@/lib/journey";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/goals")({
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{String(error)}</div>,
  notFoundComponent: () => <div>Não encontrado</div>,
  component: GoalsPage,
});

type Cat = "corpo"|"mente"|"espirito"|"prosperidade"|"relacionamentos"|"proposito";
interface DraftGoal { categoria: Cat; titulo: string }

function GoalsPage() {
  const listFn = useServerFn(listGoals);
  const setFn = useServerFn(setGoals);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["goals"],
    queryFn: () => listFn({ data: undefined as unknown as never }),
  });

  const [draft, setDraft] = useState<DraftGoal[]>([]);
  const [cat, setCat] = useState<Cat>("corpo");
  const [titulo, setTitulo] = useState("");

  const goals = query.data ?? [];
  const combined = [...goals.map((g) => ({ categoria: g.categoria as Cat, titulo: g.titulo })), ...draft];

  const saveM = useMutation({
    mutationFn: (all: DraftGoal[]) => setFn({ data: { goals: all } }),
    onSuccess: () => { toast.success("Metas salvas"); setDraft([]); qc.invalidateQueries({ queryKey: ["goals"] }); qc.invalidateQueries({ queryKey: ["journey"] }); },
    onError: (e) => toast.error(e.message),
  });

  function addDraft() {
    if (titulo.trim().length < 2) return toast.error("Título muito curto");
    setDraft((d) => [...d, { categoria: cat, titulo: titulo.trim() }]);
    setTitulo("");
  }

  function removeAt(i: number) {
    const all = [...combined];
    all.splice(i, 1);
    saveM.mutate(all);
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
            <Button onClick={() => saveM.mutate(combined)} disabled={saveM.isPending}>Salvar {draft.length} nova(s)</Button>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 font-display font-semibold">Suas metas</h2>
        {combined.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma meta ainda.</p>
        ) : (
          <ul className="space-y-2">
            {combined.map((g, i) => {
              const c = CATEGORIAS.find((x) => x.id === g.categoria);
              return (
                <li key={i} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{c?.emoji}</span>
                    <div>
                      <p className="text-sm font-medium">{g.titulo}</p>
                      <p className="text-xs text-muted-foreground">{c?.nome}</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeAt(i)} aria-label="Remover">
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
