import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2, Flame, Pencil } from "lucide-react";
import { toast } from "sonner";

import { createHabit, updateHabit, deleteHabit, completeHabit } from "@/lib/journey.functions";
import { journeyQueryOptions, type JourneyData } from "@/lib/journey-queries";
import { ATRIBUTO_LABELS, CATEGORIAS } from "@/lib/journey";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/habits")({
  loader: ({ context }) => context.queryClient.ensureQueryData(journeyQueryOptions()),
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{String(error)}</div>,
  notFoundComponent: () => <div>Não encontrado</div>,
  component: HabitsPage,
});

type HabitRow = JourneyData["habits"][number];
type HabitAttr = HabitRow["atributo"];
type HabitCategory = NonNullable<HabitRow["categoria"]>;

type HabitFormValues = {
  titulo: string;
  xp_recompensa: number;
  atributo: HabitAttr;
  categoria?: HabitCategory;
};

function HabitsPage() {
  const { data } = useSuspenseQuery(journeyQueryOptions());
  const qc = useQueryClient();
  const createFn = useServerFn(createHabit);
  const updateFn = useServerFn(updateHabit);
  const deleteFn = useServerFn(deleteHabit);
  const completeFn = useServerFn(completeHabit);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<HabitRow | null>(null);

  const createM = useMutation({
    mutationFn: (input: HabitFormValues) => createFn({ data: input }),
    onSuccess: (row) => {
      toast.success("Hábito criado");
      setCreateOpen(false);
      qc.setQueryData<JourneyData>(["journey"], (old) =>
        old ? { ...old, habits: [...old.habits, row] } : old,
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const updateM = useMutation({
    mutationFn: (input: HabitFormValues & { id: string }) => updateFn({ data: input }),
    onSuccess: (row) => {
      toast.success("Hábito atualizado");
      setEditing(null);
      qc.setQueryData<JourneyData>(["journey"], (old) =>
        old
          ? { ...old, habits: old.habits.map((h) => (h.id === row.id ? row : h)) }
          : old,
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["journey"] });
      const prev = qc.getQueryData<JourneyData>(["journey"]);
      qc.setQueryData<JourneyData>(["journey"], (old) =>
        old
          ? {
              ...old,
              habits: old.habits.filter((h) => h.id !== id),
              completedToday: old.completedToday.filter((hid) => hid !== id),
            }
          : old,
      );
      return { prev };
    },
    onSuccess: () => toast.success("Hábito removido"),
    onError: (e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["journey"], ctx.prev);
      toast.error(e.message);
    },
  });

  const completeM = useMutation({
    mutationFn: (id: string) => completeFn({ data: { habitId: id } }),
    onMutate: async (habitId) => {
      await qc.cancelQueries({ queryKey: ["journey"] });
      const prev = qc.getQueryData<JourneyData>(["journey"]);
      if (prev && !prev.completedToday.includes(habitId)) {
        qc.setQueryData<JourneyData>(["journey"], {
          ...prev,
          completedToday: [...prev.completedToday, habitId],
        });
      }
      return { prev };
    },
    onSuccess: (r) => {
      toast.success(`+${r.xpGanho} XP`);
      qc.setQueryData<JourneyData>(["journey"], (old) => {
        if (!old?.profile) return old;
        return {
          ...old,
          completedToday: old.completedToday.includes(r.habitId)
            ? old.completedToday
            : [...old.completedToday, r.habitId],
          profile: {
            ...old.profile,
            xp_total: r.novoXpTotal,
            streak_atual: r.streak,
            streak_maximo: r.streakMaximo,
          },
          attributes:
            old.attributes && r.atributo && r.novoAttrValor != null
              ? { ...old.attributes, [r.atributo]: r.novoAttrValor }
              : old.attributes,
        };
      });
    },
    onError: (e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["journey"], ctx.prev);
      toast.error(e.message);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Hábitos</h1>
          <p className="text-sm text-muted-foreground">Rituais diários que forjam o herói.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1 h-4 w-4" />
              Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo hábito</DialogTitle>
            </DialogHeader>
            <HabitForm
              submitLabel="Criar hábito"
              onSubmit={(v) => createM.mutate(v)}
              loading={createM.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar hábito</DialogTitle>
          </DialogHeader>
          {editing && (
            <HabitForm
              key={editing.id}
              initial={editing}
              submitLabel="Salvar"
              onSubmit={(v) => updateM.mutate({ id: editing.id, ...v })}
              loading={updateM.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

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
                <li key={h.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{h.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {ATRIBUTO_LABELS[h.atributo]} · +{h.xp_recompensa} XP
                      {h.categoria ? ` · ${h.categoria}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1 sm:gap-2">
                    <Button
                      size="sm"
                      variant={done ? "secondary" : "default"}
                      disabled={done || completeM.isPending}
                      onClick={() => completeM.mutate(h.id)}
                    >
                      <Flame className="mr-1 h-3.5 w-3.5" />
                      {done ? "Feito" : "Fazer"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditing(h)}
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteM.mutate(h.id)}
                      aria-label="Remover"
                    >
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

function HabitForm({
  initial,
  onSubmit,
  loading,
  submitLabel,
}: {
  initial?: Pick<HabitRow, "titulo" | "xp_recompensa" | "atributo" | "categoria">;
  onSubmit: (v: HabitFormValues) => void;
  loading: boolean;
  submitLabel: string;
}) {
  const [titulo, setTitulo] = useState(initial?.titulo ?? "");
  const [xp, setXp] = useState(initial?.xp_recompensa ?? 10);
  const [atributo, setAtributo] = useState<HabitAttr>(initial?.atributo ?? "disciplina");
  const [categoria, setCategoria] = useState<HabitCategory>(initial?.categoria ?? "mente");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ titulo, xp_recompensa: xp, atributo, categoria });
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>Título</Label>
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex: Treinar 30 min"
          required
          minLength={2}
          maxLength={80}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Atributo</Label>
          <Select value={atributo} onValueChange={(v) => setAtributo(v as HabitAttr)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ATRIBUTO_LABELS).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={categoria} onValueChange={(v) => setCategoria(v as HabitCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.emoji} {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>XP por conclusão ({xp})</Label>
        <input
          type="range"
          min={5}
          max={100}
          step={5}
          value={xp}
          onChange={(e) => setXp(Number(e.target.value))}
          className="w-full accent-hero"
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {submitLabel}
      </Button>
    </form>
  );
}
