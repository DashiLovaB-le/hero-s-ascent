import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Check,
  Compass,
  Link2,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Star,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  completeGoal,
  createGoal,
  createHabitForGoal,
  deleteGoal,
  linkHabitToGoal,
  updateGoal,
  type GoalBoardItem,
} from "@/lib/goals.functions";
import { goalsBoardQueryOptions } from "@/lib/journey-queries";
import { CATEGORIAS } from "@/lib/journey";
import { showXpGainPopup } from "@/components/XpGainPopup";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/goals")({
  loader: ({ context }) => context.queryClient.ensureQueryData(goalsBoardQueryOptions()),
  errorComponent: ({ error }) => (
    <div className="p-6 text-destructive">
      {error instanceof Error ? error.message : String(error ?? "Falha ao carregar metas")}
    </div>
  ),
  component: GoalsPage,
});

type Cat = "corpo" | "mente" | "espirito" | "prosperidade" | "relacionamentos" | "proposito";

function catMeta(id: string) {
  return CATEGORIAS.find((c) => c.id === id);
}

function formatPrazo(prazo: string | null) {
  if (!prazo) return null;
  const [y, m, d] = prazo.split("-");
  return `${d}/${m}/${y}`;
}

function GoalsPage() {
  const qc = useQueryClient();
  const { data: board } = useSuspenseQuery(goalsBoardQueryOptions());

  const createFn = useServerFn(createGoal);
  const updateFn = useServerFn(updateGoal);
  const completeFn = useServerFn(completeGoal);
  const deleteFn = useServerFn(deleteGoal);
  const linkFn = useServerFn(linkHabitToGoal);
  const habitFn = useServerFn(createHabitForGoal);

  const [cat, setCat] = useState<Cat>("corpo");
  const [titulo, setTitulo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [asNorte, setAsNorte] = useState(false);
  const [habitDraft, setHabitDraft] = useState<Record<string, string>>({});
  const [linkPick, setLinkPick] = useState<Record<string, string>>({});

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["goals-board"] });
    await qc.invalidateQueries({ queryKey: ["goals"] });
    await qc.invalidateQueries({ queryKey: ["journey"] });
  };

  const createM = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          categoria: cat,
          titulo: titulo.trim(),
          motivo: motivo.trim() || null,
          prazo: prazo || null,
          is_norte: asNorte,
        },
      }),
    onSuccess: async () => {
      toast.success("Meta criada");
      setTitulo("");
      setMotivo("");
      setPrazo("");
      setAsNorte(false);
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeM = useMutation({
    mutationFn: (id: string) => completeFn({ data: { id } }),
    onSuccess: async (r) => {
      showXpGainPopup({
        xp: r.xpGain,
        detail: r.chapterChanged
          ? `Capítulo ${r.chapterChanged.to}: ${r.chapterChanged.nome}`
          : "Meta conquistada",
      });
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateM = useMutation({
    mutationFn: (payload: {
      id: string;
      titulo?: string;
      motivo?: string | null;
      prazo?: string | null;
      is_norte?: boolean;
      status?: "ativa" | "pausada" | "concluida";
    }) => updateFn({ data: payload }),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: async () => {
      toast.success("Meta removida");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkM = useMutation({
    mutationFn: (p: { habitId: string; goalId: string | null }) => linkFn({ data: p }),
    onSuccess: async () => {
      toast.success("Hábito atualizado");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const habitM = useMutation({
    mutationFn: (p: { goalId: string; titulo: string }) => habitFn({ data: p }),
    onSuccess: async (_, vars) => {
      toast.success("Hábito criado e ligado à meta");
      setHabitDraft((d) => ({ ...d, [vars.goalId]: "" }));
      await invalidate();
      await qc.invalidateQueries({ queryKey: ["habits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const empty = board.goals.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Metas</h1>
        <p className="text-sm text-muted-foreground">
          O norte da jornada — ligue hábitos, acompanhe o ritmo e conquiste.
        </p>
      </div>

      <Card className="border-hero/30 bg-hero/5 p-4">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-hero" />
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.18em] text-hero">Charlie</p>
            <p className="mt-1 text-sm text-foreground/90">{board.charlieHint}</p>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link to="/mentor">Abrir mentor</Link>
            </Button>
          </div>
        </div>
      </Card>

      {board.missions.length > 0 ? (
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold">
            <Compass className="h-4 w-4 text-hero" />
            Missões do capítulo
          </h2>
          <ul className="space-y-2">
            {board.missions.map((m) => {
              const pct = m.meta > 0 ? Math.min(100, Math.round((m.progresso / m.meta) * 100)) : 0;
              return (
                <li key={m.id} className="rounded-lg border border-border bg-surface/60 p-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{m.titulo}</span>
                    <span className="text-xs text-muted-foreground">
                      {m.kind === "principal" ? "Principal" : "Secundária"} · {m.progresso}/{m.meta}
                    </span>
                  </div>
                  <Progress value={pct} className="mt-2 h-1.5" />
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <Card className="p-5">
        <h2 className="mb-4 font-display font-semibold">Nova meta</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={cat} onValueChange={(v) => setCat(v as Cat)}>
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
          <div className="space-y-1.5">
            <Label>Prazo (opcional)</Label>
            <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Título</Label>
            <Input
              placeholder="Ex: Consistência de treino 4x/semana"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Por quê isso importa?</Label>
            <Textarea
              placeholder="Uma frase — o motivo que te segura nos dias ruins."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              maxLength={200}
              rows={2}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="accent-[var(--hero,#FC6E20)]"
              checked={asNorte}
              onChange={(e) => setAsNorte(e.target.checked)}
            />
            Marcar como norte (máx. 3)
          </label>
          <Button
            disabled={createM.isPending || titulo.trim().length < 2}
            onClick={() => createM.mutate()}
          >
            <Plus className="h-4 w-4" /> Criar meta
          </Button>
        </div>
      </Card>

      {empty ? (
        <Card className="border-dashed p-8 text-center">
          <Target className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-display text-lg">Nenhuma meta ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha 1–3 nortes por categoria — ou peça ao Charlie três metas sob medida.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline">
              <Link to="/mentor">Pedir sugestões ao Charlie</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {board.nortes.length > 0 ? (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-hero">
                <Star className="h-4 w-4" /> Norte
              </h2>
              {board.nortes.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  unlinkedHabits={board.unlinkedHabits}
                  habitDraft={habitDraft[g.id] ?? ""}
                  linkPick={linkPick[g.id] ?? ""}
                  onHabitDraft={(v) => setHabitDraft((d) => ({ ...d, [g.id]: v }))}
                  onLinkPick={(v) => setLinkPick((d) => ({ ...d, [g.id]: v }))}
                  busy={
                    completeM.isPending ||
                    updateM.isPending ||
                    deleteM.isPending ||
                    linkM.isPending ||
                    habitM.isPending
                  }
                  onComplete={() => completeM.mutate(g.id)}
                  onPause={() => updateM.mutate({ id: g.id, status: "pausada" })}
                  onResume={() => updateM.mutate({ id: g.id, status: "ativa" })}
                  onToggleNorte={() => updateM.mutate({ id: g.id, is_norte: !g.is_norte })}
                  onDelete={() => deleteM.mutate(g.id)}
                  onCreateHabit={() => {
                    const t = (habitDraft[g.id] ?? "").trim();
                    if (t.length < 2) return toast.error("Título do hábito muito curto");
                    habitM.mutate({ goalId: g.id, titulo: t });
                  }}
                  onLinkHabit={() => {
                    const hid = linkPick[g.id];
                    if (!hid) return toast.error("Escolha um hábito");
                    linkM.mutate({ habitId: hid, goalId: g.id });
                  }}
                  onUnlink={(habitId) => linkM.mutate({ habitId, goalId: null })}
                />
              ))}
            </section>
          ) : null}

          {board.ativas.filter((g) => !g.is_norte).length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Ativas
              </h2>
              {board.ativas
                .filter((g) => !g.is_norte)
                .map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    unlinkedHabits={board.unlinkedHabits}
                    habitDraft={habitDraft[g.id] ?? ""}
                    linkPick={linkPick[g.id] ?? ""}
                    onHabitDraft={(v) => setHabitDraft((d) => ({ ...d, [g.id]: v }))}
                    onLinkPick={(v) => setLinkPick((d) => ({ ...d, [g.id]: v }))}
                    busy={
                      completeM.isPending ||
                      updateM.isPending ||
                      deleteM.isPending ||
                      linkM.isPending ||
                      habitM.isPending
                    }
                    onComplete={() => completeM.mutate(g.id)}
                    onPause={() => updateM.mutate({ id: g.id, status: "pausada" })}
                    onResume={() => updateM.mutate({ id: g.id, status: "ativa" })}
                    onToggleNorte={() => updateM.mutate({ id: g.id, is_norte: !g.is_norte })}
                    onDelete={() => deleteM.mutate(g.id)}
                    onCreateHabit={() => {
                      const t = (habitDraft[g.id] ?? "").trim();
                      if (t.length < 2) return toast.error("Título do hábito muito curto");
                      habitM.mutate({ goalId: g.id, titulo: t });
                    }}
                    onLinkHabit={() => {
                      const hid = linkPick[g.id];
                      if (!hid) return toast.error("Escolha um hábito");
                      linkM.mutate({ habitId: hid, goalId: g.id });
                    }}
                    onUnlink={(habitId) => linkM.mutate({ habitId, goalId: null })}
                  />
                ))}
            </section>
          ) : null}

          {board.pausadas.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Pausadas
              </h2>
              {board.pausadas.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  unlinkedHabits={board.unlinkedHabits}
                  habitDraft={habitDraft[g.id] ?? ""}
                  linkPick={linkPick[g.id] ?? ""}
                  onHabitDraft={(v) => setHabitDraft((d) => ({ ...d, [g.id]: v }))}
                  onLinkPick={(v) => setLinkPick((d) => ({ ...d, [g.id]: v }))}
                  busy={updateM.isPending || deleteM.isPending}
                  onComplete={() => completeM.mutate(g.id)}
                  onPause={() => updateM.mutate({ id: g.id, status: "pausada" })}
                  onResume={() => updateM.mutate({ id: g.id, status: "ativa" })}
                  onToggleNorte={() => updateM.mutate({ id: g.id, is_norte: !g.is_norte })}
                  onDelete={() => deleteM.mutate(g.id)}
                  onCreateHabit={() => undefined}
                  onLinkHabit={() => undefined}
                  onUnlink={() => undefined}
                  compact
                />
              ))}
            </section>
          ) : null}

          {board.concluidas.length > 0 ? (
            <section className="space-y-2">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Conquistadas
              </h2>
              <ul className="space-y-2">
                {board.concluidas.map((g) => {
                  const c = catMeta(g.categoria);
                  return (
                    <li
                      key={g.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-surface/40 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span>
                          {c?.emoji} {g.titulo}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        +{g.xp_recompensa} XP
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  unlinkedHabits,
  habitDraft,
  linkPick,
  onHabitDraft,
  onLinkPick,
  busy,
  onComplete,
  onPause,
  onResume,
  onToggleNorte,
  onDelete,
  onCreateHabit,
  onLinkHabit,
  onUnlink,
  compact,
}: {
  goal: GoalBoardItem;
  unlinkedHabits: Array<{ id: string; titulo: string; categoria: string | null }>;
  habitDraft: string;
  linkPick: string;
  onHabitDraft: (v: string) => void;
  onLinkPick: (v: string) => void;
  busy: boolean;
  onComplete: () => void;
  onPause: () => void;
  onResume: () => void;
  onToggleNorte: () => void;
  onDelete: () => void;
  onCreateHabit: () => void;
  onLinkHabit: () => void;
  onUnlink: (habitId: string) => void;
  compact?: boolean;
}) {
  const c = catMeta(goal.categoria);
  const prazoLabel = formatPrazo(goal.prazo);

  return (
    <Card
      className={cn(
        "p-4",
        goal.is_norte && "border-hero/40",
        goal.overdue && "border-amber-500/40",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg">{c?.emoji}</span>
            <p className="font-medium">{goal.titulo}</p>
            {goal.is_norte ? (
              <span className="rounded bg-hero/15 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wider text-hero">
                Norte
              </span>
            ) : null}
            {goal.overdue ? (
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[0.65rem] text-amber-200">
                Prazo passou
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {c?.nome}
            {prazoLabel ? ` · até ${prazoLabel}` : ""}
          </p>
          {goal.motivo ? (
            <p className="mt-2 text-sm text-foreground/80">“{goal.motivo}”</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {goal.status === "ativa" ? (
            <>
              <Button size="sm" className="shadow-hero" disabled={busy} onClick={onComplete}>
                <Check className="h-4 w-4" /> Conquistar
              </Button>
              <Button size="icon" variant="ghost" disabled={busy} onClick={onPause} aria-label="Pausar">
                <Pause className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={onResume}>
              <Play className="h-4 w-4" /> Retomar
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            disabled={busy}
            onClick={onToggleNorte}
            aria-label="Alternar norte"
          >
            <Star className={cn("h-4 w-4", goal.is_norte && "fill-hero text-hero")} />
          </Button>
          <Button size="icon" variant="ghost" disabled={busy} onClick={onDelete} aria-label="Remover">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!compact ? (
        <>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>
                Ritmo 7 dias
                {goal.progressSource === "category"
                  ? " · hábitos da categoria (ainda sem vínculo)"
                  : goal.progressSource === "none"
                    ? " · sem hábitos"
                    : ""}
              </span>
              <span className="font-mono">{goal.progressPct}%</span>
            </div>
            <Progress value={goal.progressPct} className="h-2" />
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Hábitos que sustentam</p>
            {goal.habits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum hábito ligado ainda.</p>
            ) : (
              <ul className="space-y-1">
                {goal.habits.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between rounded-md border border-border/70 bg-surface/50 px-2.5 py-1.5 text-sm"
                  >
                    <span className={cn(h.doneToday && "text-emerald-300")}>
                      {h.doneToday ? "✓ " : ""}
                      {h.titulo}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {h.completions7d}/7d
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      disabled={busy}
                      onClick={() => onUnlink(h.id)}
                    >
                      Desligar
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-2 pt-1 sm:grid-cols-[1fr_auto]">
              <Input
                placeholder="Novo hábito para esta meta…"
                value={habitDraft}
                onChange={(e) => onHabitDraft(e.target.value)}
                maxLength={80}
              />
              <Button size="sm" variant="secondary" disabled={busy} onClick={onCreateHabit}>
                <Plus className="h-4 w-4" /> Criar
              </Button>
            </div>

            {unlinkedHabits.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Select value={linkPick || undefined} onValueChange={onLinkPick}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ligar hábito existente…" />
                  </SelectTrigger>
                  <SelectContent>
                    {unlinkedHabits.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" disabled={busy || !linkPick} onClick={onLinkHabit}>
                  <Link2 className="h-4 w-4" /> Ligar
                </Button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </Card>
  );
}
