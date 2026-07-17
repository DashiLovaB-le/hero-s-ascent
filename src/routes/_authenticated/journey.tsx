import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Flame, Check, Sparkles, ChevronRight, Trophy, Target } from "lucide-react";
import { toast } from "sonner";

import { bootstrapUser, getJourney, completeHabit } from "@/lib/journey.functions";
import { calcularNivel, fraseDoDia, ATRIBUTO_LABELS } from "@/lib/journey";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";

const journeyQO = () => queryOptions({
  queryKey: ["journey"],
  queryFn: () => getJourney({ data: undefined as unknown as never }),
});

export const Route = createFileRoute("/_authenticated/journey")({
  loader: async ({ context }) => {
    await bootstrapUser({ data: undefined as unknown as never });
    await context.queryClient.ensureQueryData(journeyQO());
  },
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{String(error)}</div>,
  notFoundComponent: () => <div>Não encontrado</div>,
  component: JourneyPage,
});

function JourneyPage() {
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(journeyQO());
  const queryClient = useQueryClient();
  const completeFn = useServerFn(completeHabit);

  const profile = data.profile;
  const attrs = data.attributes;

  useEffect(() => {
    if (profile && !profile.onboarding_completo) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [profile, navigate]);

  const mutation = useMutation({
    mutationFn: (habitId: string) => completeFn({ data: { habitId } }),
    onSuccess: (res) => {
      toast.success(`+${res.xpGanho} XP · Streak ${res.streak}🔥`);
      queryClient.invalidateQueries({ queryKey: ["journey"] });
    },
    onError: (err) => toast.error(err.message),
  });

  if (!profile || !attrs) return null;

  const level = calcularNivel(profile.xp_total);
  const habitsRestantes = data.habits.filter((h) => !data.completedToday.includes(h.id));
  const totalHoje = data.habits.length;
  const feitos = data.completedToday.length;

  return (
    <div className="space-y-6">
      {/* HERO CARD */}
      <Card className="overflow-hidden border-hero/30 bg-hero-glow p-6 shadow-elevated">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-hero text-hero-foreground shadow-hero">
              <span className="font-display text-2xl font-bold">{level.atual.nivel}</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-hero">{level.atual.titulo}</p>
              <h1 className="font-display text-2xl font-bold">{profile.nome}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Capítulo {profile.capitulo_atual} — {chapterName(profile.capitulo_atual)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-strength/30 bg-strength/10 px-3 py-1.5 text-strength">
            <Flame className="h-4 w-4" />
            <span className="text-sm font-semibold">{profile.streak_atual}</span>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              {profile.xp_total.toLocaleString("pt-BR")} XP
            </span>
            {level.proximo && (
              <span className="text-xs text-muted-foreground">
                {level.xp_para_proximo.toLocaleString("pt-BR")} para {level.proximo.titulo}
              </span>
            )}
          </div>
          <Progress value={level.progresso * 100} className="h-2" />
        </div>

        <p className="mt-6 border-l-2 border-hero pl-4 font-display text-sm italic text-muted-foreground">
          "{fraseDoDia()}"
        </p>
      </Card>

      {/* MISSÃO PRINCIPAL / HÁBITOS DE HOJE */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Missão de hoje</h2>
            <p className="text-sm text-muted-foreground">
              {feitos} de {totalHoje} hábitos concluídos
            </p>
          </div>
          <Link to="/habits">
            <Button variant="ghost" size="sm">
              Gerenciar <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {totalHoje > 0 && <Progress value={(feitos / totalHoje) * 100} className="mb-4 h-1.5" />}

        {data.habits.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center">
            <Target className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhum hábito ainda. Crie o primeiro.</p>
            <Link to="/habits" className="mt-4 inline-block">
              <Button size="sm">Criar hábito</Button>
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.habits.map((h) => {
              const done = data.completedToday.includes(h.id);
              return (
                <li
                  key={h.id}
                  className={`flex items-center justify-between rounded-lg border p-3 transition-all ${
                    done ? "border-hero/40 bg-hero/5" : "border-border bg-surface hover:border-hero/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => !done && mutation.mutate(h.id)}
                      disabled={done || mutation.isPending}
                      className={`grid h-8 w-8 place-items-center rounded-full border transition ${
                        done
                          ? "border-hero bg-hero text-hero-foreground"
                          : "border-border hover:border-hero"
                      }`}
                    >
                      {done && <Check className="h-4 w-4" strokeWidth={3} />}
                    </button>
                    <div>
                      <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>
                        {h.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ATRIBUTO_LABELS[h.atributo]} · +{h.xp_recompensa} XP
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {habitsRestantes.length === 0 && totalHoje > 0 && (
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-hero/40 bg-hero/10 p-4">
            <Sparkles className="h-5 w-5 text-hero" />
            <p className="text-sm">
              Dia completo, herói. Continue amanhã para manter seu streak.
            </p>
          </div>
        )}
      </Card>

      {/* ATRIBUTOS */}
      <Card className="p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Atributos</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(ATRIBUTO_LABELS).map(([key, label]) => {
            const val = (attrs as Record<string, number | string>)[key] as number;
            return (
              <div key={key} className="rounded-lg border border-border bg-surface p-3 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="mt-1 font-display text-2xl font-bold text-hero">{val}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* CONQUISTAS */}
      {data.achievements.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
            <Trophy className="h-5 w-5 text-hero" /> Conquistas recentes
          </h2>
          <ul className="space-y-2">
            {data.achievements.map((a) => {
              const ach = (a as { achievements: { titulo: string; descricao: string } }).achievements;
              return (
                <li key={a.achievement_id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <Trophy className="mt-0.5 h-4 w-4 text-hero" />
                  <div>
                    <p className="text-sm font-medium">{ach?.titulo}</p>
                    <p className="text-xs text-muted-foreground">{ach?.descricao}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function chapterName(n: number) {
  const nomes = ["O Chamado", "A Travessia", "As Provas", "O Abismo", "A Recompensa", "O Retorno", "A Lenda"];
  return nomes[n - 1] ?? "O Chamado";
}
