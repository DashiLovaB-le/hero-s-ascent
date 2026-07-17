import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useMutation, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2, Flame } from "lucide-react";
import { toast } from "sonner";

import { getJourney, createHabit, deleteHabit, completeHabit } from "@/lib/journey.functions";
import { ATRIBUTO_LABELS, CATEGORIAS } from "@/lib/journey";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const qo = () => queryOptions({
  queryKey: ["journey"],
  queryFn: () => getJourney({ data: undefined as unknown as never }),
});

export const Route = createFileRoute("/_authenticated/habits")({
  loader: ({ context }) => context.queryClient.ensureQueryData(qo()),
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{String(error)}</div>,
  notFoundComponent: () => <div>Não encontrado</div>,
  component: HabitsPage,
});

function HabitsPage() {
  const { data } = useSuspenseQuery(qo());
  const qc = useQueryClient();
  const createFn = useServerFn(createHabit);
  const deleteFn = useServerFn(deleteHabit);
  const completeFn = useServerFn(completeHabit);
  const [open, setOpen] = useState(false);

  const createM = useMutation({
    mutationFn: (input: NewHabitInput) => createFn({ data: input }),
    onSuccess: () => { toast.success("Hábito criado"); setOpen(false); qc.invalidateQueries({ queryKey: ["journey"] }); },
    onError: (e) => toast.error(e.message),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Hábito removido"); qc.invalidateQueries({ queryKey: ["journey"] }); },
    onError: (e) => toast.error(e.message),
  });
  const completeM = useMutation({
    mutationFn: (id: string) => completeFn({ data: { habitId: id } }),
    onSuccess: (r) => { toast.success(`+${r.xpGanho} XP`); qc.invalidateQueries({ queryKey: ["journey"] }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Hábitos</h1>
          <p className="text-sm text-muted-foreground">Rituais diários que forjam o herói.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" />Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo hábito</DialogTitle></DialogHeader>
            <NewHabitForm onSubmit={(v) => createM.mutate(v)} loading={createM.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4">
        {data.habits.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sem hábitos ainda. Comece pequeno — um só.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.habits.map((h) => {
              const done = data.completedToday.includes(h.id);
              return (
                <li key={h.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{h.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {ATRIBUTO_LABELS[h.atributo]} · +{h.xp_recompensa} XP{h.categoria ? ` · ${h.categoria}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant={done ? "secondary" : "default"} disabled={done || completeM.isPending} onClick={() => completeM.mutate(h.id)}>
                      <Flame className="mr-1 h-3.5 w-3.5" />{done ? "Feito" : "Fazer"}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteM.mutate(h.id)} aria-label="Remover">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

type NewHabitInput = { titulo: string; xp_recompensa: number; atributo: "forca"|"disciplina"|"sabedoria"|"espirito"|"testosterona"|"prosperidade"|"conhecimento"|"lideranca"; categoria?: "corpo"|"mente"|"espirito"|"prosperidade"|"relacionamentos"|"proposito" };
function NewHabitForm({ onSubmit, loading }: { onSubmit: (v: NewHabitInput) => void; loading: boolean }) {
  const [titulo, setTitulo] = useState("");
  const [xp, setXp] = useState(10);
  const [atributo, setAtributo] = useState<"forca"|"disciplina"|"sabedoria"|"espirito"|"testosterona"|"prosperidade"|"conhecimento"|"lideranca">("disciplina");
  const [categoria, setCategoria] = useState<"corpo"|"mente"|"espirito"|"prosperidade"|"relacionamentos"|"proposito">("mente");

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ titulo, xp_recompensa: xp, atributo, categoria }); }} className="space-y-4">
      <div className="space-y-2">
        <Label>Título</Label>
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Treinar 30 min" required minLength={2} maxLength={80} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Atributo</Label>
          <Select value={atributo} onValueChange={(v) => setAtributo(v as typeof atributo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ATRIBUTO_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={categoria} onValueChange={(v) => setCategoria(v as typeof categoria)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.emoji} {c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>XP por conclusão ({xp})</Label>
        <input type="range" min={5} max={100} step={5} value={xp} onChange={(e) => setXp(Number(e.target.value))} className="w-full accent-hero" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>Criar hábito</Button>
    </form>
  );
}
