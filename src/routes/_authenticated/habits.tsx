import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Trash2, Pencil, Sparkles, Check, ChevronsUp, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import {
  createHabit,
  updateHabit,
  deleteHabit,
  completeHabit,
  listGoals,
} from "@/lib/journey.functions";
import {
  suggestHabitsFromGoals,
  createHabitsBulk,
  type HabitSuggestion,
} from "@/lib/habit-suggest";
import { journeyQueryOptions, type JourneyData } from "@/lib/journey-queries";
import { ATRIBUTO_LABELS, CATEGORIAS } from "@/lib/journey";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { showXpGainPopup } from "@/components/XpGainPopup";
import { HABIT_XP_DEFAULT } from "@/lib/habit-xp";

export const Route = createFileRoute("/_authenticated/habits")({
  loader: ({ context }) => context.queryClient.ensureQueryData(journeyQueryOptions()),
  errorComponent: ({ error }) => (
    <div className="p-6 text-destructive">
      {error instanceof Error ? error.message : String(error ?? "Falha ao carregar hábitos")}
    </div>
  ),
  notFoundComponent: () => <div>Não encontrado</div>,
  component: HabitsPage,
});

type HabitRow = JourneyData["habits"][number];
type HabitAttr = HabitRow["atributo"];
type HabitCategory = NonNullable<HabitRow["categoria"]>;

type HabitFormValues = {
  titulo: string;
  descricao?: string | null;
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
  const suggestFn = useServerFn(suggestHabitsFromGoals);
  const bulkFn = useServerFn(createHabitsBulk);
  const goalsFn = useServerFn(listGoals);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<HabitRow | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<HabitSuggestion[]>([]);

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
      const detailParts: string[] = [];
      if (r.unlockedAchievements?.length) {
        detailParts.push(r.unlockedAchievements.map((a) => a.titulo).join(", "));
      }
      showXpGainPopup({
        xp: r.xpGanho,
        detail: detailParts.length ? detailParts.join(" · ") : null,
      });
      if (r.chapterChanged) {
        toast.success(`Capítulo ${r.chapterChanged.to}: ${r.chapterChanged.nome}`);
      }
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
            capitulo_atual: r.capitulo_atual ?? old.profile.capitulo_atual,
          },
          attributes:
            old.attributes && r.atributo && r.novoAttrValor != null
              ? { ...old.attributes, [r.atributo]: r.novoAttrValor }
              : old.attributes,
        };
      });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      void qc.invalidateQueries({ queryKey: ["missions"] });
      void qc.invalidateQueries({ queryKey: ["activity-history"] });
    },
    onError: (e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["journey"], ctx.prev);
      toast.error(e.message);
    },
  });

  const suggestM = useMutation({
    mutationFn: async () => {
      const goals = await goalsFn({ data: undefined as unknown as never });
      return suggestFn({
        data: {
          goals: goals.map((g) => ({
            categoria: g.categoria as HabitSuggestion["categoria"],
            titulo: g.titulo,
          })),
        },
      });
    },
    onSuccess: (res) => {
      setSuggestions(res.habits);
      setSuggestOpen(true);
      if (res.source === "fallback") {
        toast.message("Usando sugestões prontas (IA indisponível ou fallback).");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const acceptSuggestM = useMutation({
    mutationFn: () => bulkFn({ data: { habits: suggestions } }),
    onSuccess: (res) => {
      toast.success(`${res.habits.length} hábitos adicionados`);
      setSuggestOpen(false);
      setSuggestions([]);
      void qc.invalidateQueries({ queryKey: ["journey"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const declaredHabits = data.habits.filter((h) => !h.exercise_type_id);
  const validatedHabits = data.habits.filter((h) => Boolean(h.exercise_type_id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Hábitos</h1>
          <p className="text-sm text-muted-foreground">Rituais diários que forjam o herói.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => suggestM.mutate()}
            disabled={suggestM.isPending}
          >
            <img
              src="/charlie-ico.ico"
              alt=""
              aria-hidden
              className="mr-1 h-4 w-4 shrink-0 object-contain"
            />
            {suggestM.isPending ? "Gerando…" : "Sugerir com Charlie"}
          </Button>
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
                habitXpReward={data.habitXpReward ?? HABIT_XP_DEFAULT}
                onSubmit={(v) => createM.mutate(v)}
                loading={createM.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sugestões do Charlie</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {suggestions.map((h, i) => (
              <div key={i} className="space-y-2 border border-border p-3">
                <Input
                  value={h.titulo}
                  onChange={(e) => {
                    const next = [...suggestions];
                    next[i] = { ...next[i], titulo: e.target.value };
                    setSuggestions(next);
                  }}
                />
                {h.descricao ? (
                  <p className="text-xs text-muted-foreground">{h.descricao}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {ATRIBUTO_LABELS[h.atributo]} · +{data.habitXpReward ?? h.xp_recompensa} XP
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSuggestions(suggestions.filter((_, x) => x !== i))}
                >
                  Remover
                </Button>
              </div>
            ))}
          </div>
          <Button
            className="w-full"
            disabled={acceptSuggestM.isPending || suggestions.length === 0}
            onClick={() => acceptSuggestM.mutate()}
          >
            <Check className="mr-1 h-4 w-4" />
            Adicionar selecionados
          </Button>
        </DialogContent>
      </Dialog>

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
              habitXpReward={data.habitXpReward ?? HABIT_XP_DEFAULT}
              submitLabel="Salvar"
              onSubmit={(v) => updateM.mutate({ id: editing.id, ...v })}
              loading={updateM.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <Link to="/exercises/$slug" params={{ slug: "pushup" }} className="block">
        <div className="cp-panel flex items-center gap-4 border border-transparent bg-hero-glow p-4 transition-[filter] hover:brightness-110">
          <div className="grid h-12 w-12 place-items-center bg-hero/20 text-hero">
            <ChevronsUp className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-hero">Exercício validado</p>
            <p className="font-display text-lg leading-tight">Flexão</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sessão com câmera · sem gravar vídeo · XP por evidência
              {validatedHabits.length > 0 ? " · hábito ativo" : ""}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-hero" />
        </div>
      </Link>

      <Card className="p-4">
        {declaredHabits.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Sem hábitos declarados ainda. Comece pequeno — ou peça sugestões ao Charlie.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => suggestM.mutate()}
              disabled={suggestM.isPending}
            >
              <Sparkles className="mr-1 h-4 w-4" />
              Sugerir rotina
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {declaredHabits.map((h) => {
              const done = data.completedToday.includes(h.id);
              return (
                <li key={h.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{h.titulo}</p>
                    {h.descricao?.trim() ? (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{h.descricao}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {ATRIBUTO_LABELS[h.atributo]} · +{data.habitXpReward ?? HABIT_XP_DEFAULT} XP
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
                      <img
                        src="/animate-icons/flame.gif"
                        alt=""
                        aria-hidden
                        className="mr-1 h-3.5 w-3.5 shrink-0 object-contain"
                      />
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
  habitXpReward = HABIT_XP_DEFAULT,
  onSubmit,
  loading,
  submitLabel,
}: {
  initial?: Pick<HabitRow, "titulo" | "descricao" | "atributo" | "categoria">;
  habitXpReward?: number;
  onSubmit: (v: HabitFormValues) => void;
  loading: boolean;
  submitLabel: string;
}) {
  const [titulo, setTitulo] = useState(initial?.titulo ?? "");
  const [descricao, setDescricao] = useState(initial?.descricao ?? "");
  const [atributo, setAtributo] = useState<HabitAttr>(initial?.atributo ?? "disciplina");
  const [categoria, setCategoria] = useState<HabitCategory | "">(
    (initial?.categoria as HabitCategory | undefined) ?? "",
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          titulo,
          descricao: descricao.trim() || null,
          atributo,
          ...(categoria ? { categoria } : {}),
        });
      }}
    >
      <div className="space-y-2">
        <Label>Título</Label>
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required minLength={2} />
      </div>
      <div className="space-y-2">
        <Label>Detalhes (opcional)</Label>
        <Textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="Como você faz esse hábito? Ex.: 10 min sem celular após acordar."
        />
        <p className="text-[11px] text-muted-foreground">
          O Charlie usa isso para entender melhor o contexto.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Recompensa fixa do sistema: <span className="font-medium text-foreground">+{habitXpReward} XP</span>
      </p>
      <div className="space-y-2">
        <Label>Atributo</Label>
        <Select value={atributo} onValueChange={(v) => setAtributo(v as HabitAttr)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ATRIBUTO_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select
          value={categoria || undefined}
          onValueChange={(v) => setCategoria(v as HabitCategory)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Opcional" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
