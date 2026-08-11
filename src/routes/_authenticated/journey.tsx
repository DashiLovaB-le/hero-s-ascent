import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Check, Sparkles, ChevronRight, Trophy, Target, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { completeHabit } from "@/lib/journey.functions";
import {
  journeyQueryOptions,
  missionsQueryOptions,
  type JourneyData,
} from "@/lib/journey-queries";
import { calcularNivel, fraseDoDia, ATRIBUTO_LABELS } from "@/lib/journey";
import { setWallpaperCatalog } from "@/lib/wallpapers";
import { chapterName } from "@/lib/chapters";
import { MentorJourneyCard } from "@/mentor/MentorJourneyCard";
import { AlterEgoJourneyCard } from "@/components/AlterEgoJourneyCard";
import { CheckinCard } from "@/components/CheckinCard";
import { WeatherCard } from "@/components/WeatherCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { showXpGainPopup } from "@/components/XpGainPopup";
import { firstCodigoLine } from "@/lib/alter-ego";
import { identityArcForChapter } from "@/lib/identity-proofs";

function JourneyPending() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-40 rounded-xl border border-border bg-surface" />
      <div className="h-56 rounded-xl border border-border bg-surface" />
      <div className="h-32 rounded-xl border border-border bg-surface" />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/journey")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(journeyQueryOptions()),
      context.queryClient.ensureQueryData(missionsQueryOptions()),
    ]);
  },
  pendingComponent: JourneyPending,
  errorComponent: ({ error }) => (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
      {error instanceof Error ? error.message : String(error ?? "Falha ao carregar a jornada")}
    </div>
  ),
  notFoundComponent: () => <div>Não encontrado</div>,
  component: JourneyPage,
});

function patchComplete(old: JourneyData | undefined, res: Awaited<ReturnType<typeof completeHabit>>): JourneyData | undefined {
  if (!old?.profile) return old;
  const attrs = old.attributes
    ? {
        ...old.attributes,
        ...(res.atributo && res.novoAttrValor != null
          ? { [res.atributo]: res.novoAttrValor }
          : {}),
      }
    : old.attributes;
  return {
    ...old,
    completedToday: old.completedToday.includes(res.habitId)
      ? old.completedToday
      : [...old.completedToday, res.habitId],
    profile: {
      ...old.profile,
      xp_total: res.novoXpTotal,
      streak_atual: res.streak,
      streak_maximo: res.streakMaximo,
      capitulo_atual: res.capitulo_atual ?? old.profile.capitulo_atual,
    },
    attributes: attrs,
  };
}

function JourneyPage() {
  const { data } = useSuspenseQuery(journeyQueryOptions());
  const { data: missionsData } = useSuspenseQuery(missionsQueryOptions());
  const queryClient = useQueryClient();
  const completeFn = useServerFn(completeHabit);

  const profile = data.profile;
  const attrs = data.attributes;

  const mutation = useMutation({
    mutationFn: (habitId: string) => completeFn({ data: { habitId } }),
    onMutate: async (habitId) => {
      await queryClient.cancelQueries({ queryKey: ["journey"] });
      const prev = queryClient.getQueryData<JourneyData>(["journey"]);
      const habit = prev?.habits.find((h) => h.id === habitId);
      if (prev?.profile && habit && !prev.completedToday.includes(habitId)) {
        const xp = habit.xp_recompensa ?? 10;
        queryClient.setQueryData<JourneyData>(["journey"], {
          ...prev,
          completedToday: [...prev.completedToday, habitId],
          profile: {
            ...prev.profile,
            xp_total: prev.profile.xp_total + xp,
            streak_atual: Math.max(prev.profile.streak_atual, 1),
          },
        });
      }
      return { prev };
    },
    onSuccess: (res) => {
      const detailParts: string[] = [`Streak ${res.streak}`];
      if (res.unlockedAchievements?.length) {
        detailParts.push(res.unlockedAchievements.map((a) => a.titulo).join(", "));
      }
      const codigo = firstCodigoLine(data.alterEgo);
      if (codigo) {
        detailParts.push("Prova de identidade");
      }
      showXpGainPopup({
        xp: res.xpGanho,
        detail: detailParts.join(" · "),
      });
      if (codigo) {
        toast.message("Prova de identidade", {
          description: "Você agiu como o homem que decidiu se tornar.",
        });
      }
      if (res.chapterChanged) {
        toast.success(`Capítulo ${res.chapterChanged.to}: ${res.chapterChanged.nome}`);
      }
      queryClient.setQueryData<JourneyData>(["journey"], (old) => patchComplete(old, res));
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      void queryClient.invalidateQueries({ queryKey: ["missions"] });
      void queryClient.invalidateQueries({ queryKey: ["activity-history"] });
      void queryClient.invalidateQueries({ queryKey: ["profile-panorama"] });
      void queryClient.invalidateQueries({ queryKey: ["identity-proofs"] });
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["journey"], ctx.prev);
      toast.error(err.message);
    },
  });

  if (!profile.onboarding_completo) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-hero">Primeiro passo</p>
        <h1 className="mt-3 font-display text-2xl font-bold">Complete seu chamado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Antes de abrir a jornada, escolha as áreas em que quer evoluir.
        </p>
        <Link to="/onboarding" className="mt-6 inline-block">
          <Button className="shadow-hero">
            Continuar onboarding <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </Card>
    );
  }

  const level = calcularNivel(profile.xp_total, data.levels);

  useEffect(() => {
    setWallpaperCatalog(data.wallpapers);
  }, [data.wallpapers]);

  const habitsRestantes = data.habits.filter(
    (h) => !h.exercise_type_id && !data.completedToday.includes(h.id),
  );
  const declaredHabits = data.habits.filter((h) => !h.exercise_type_id);
  const totalHoje = declaredHabits.length;
  const feitos = declaredHabits.filter((h) => data.completedToday.includes(h.id)).length;
  const activeMissions = missionsData.missions.filter((m) => m.status === "ativa");
  const principal = activeMissions.find((m) => m.kind === "principal");
  const secundarias = activeMissions.filter((m) => m.kind === "secundaria");

  return (
    <div className="space-y-6">
      <Card className="cp-brackets overflow-hidden border-transparent bg-hero-glow p-6 shadow-elevated">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-hero text-hero-foreground shadow-hero">
              <span className="font-display text-2xl font-bold">{level.atual.nivel}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.25em] text-hero">{level.atual.titulo}</p>
              <h1 className="truncate font-display text-2xl font-bold">{profile.nome}</h1>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                Capítulo {profile.capitulo_atual} — {chapterName(profile.capitulo_atual)}
                <span className="text-muted-foreground/70">
                  {" "}
                  · {identityArcForChapter(profile.capitulo_atual).nome}
                </span>
              </p>
            </div>
          </div>
          <div className="mt-0.5 flex shrink-0 items-center gap-1.5 border border-strength/30 bg-strength/10 px-2.5 py-1.5 text-strength sm:gap-2 sm:px-3">
            <img
              src="/animate-icons/flame.gif"
              alt=""
              aria-hidden
              className="h-4 w-4 shrink-0 object-contain"
            />
            <span className="text-sm font-semibold tabular-nums">{profile.streak_atual}</span>
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

      {(principal || secundarias.length > 0) && (
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
            <img
              src="/animate-icons/manuscript.gif"
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
              aria-hidden
            />{" "}
            Missões do capítulo
          </h2>
          <div className="space-y-3">
            {principal && <MissionCard mission={principal} />}
            {secundarias.map((m) => (
              <MissionCard key={m.id} mission={m} secondary />
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Hábitos de hoje</h2>
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

        {declaredHabits.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center">
            <Target className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum hábito ainda. Crie o primeiro ou peça sugestões ao Charlie.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link to="/habits">
                <Button size="sm">Criar hábito</Button>
              </Link>
              <Link to="/habits">
                <Button size="sm" variant="outline">
                  Sugerir com Charlie
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {declaredHabits.map((h) => {
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

      <AlterEgoJourneyCard
        alterEgo={data.alterEgo}
        proofStats={data.proofStats}
        identityArc={identityArcForChapter(profile.capitulo_atual)}
      />
      <MentorJourneyCard />
      <CheckinCard />

      <WeatherCard />

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

function MissionCard({
  mission,
  secondary,
}: {
  mission: {
    id: string;
    titulo: string;
    descricao: string;
    progresso_atual: number;
    progresso_alvo: number;
    xp_recompensa: number;
    kind: string;
  };
  secondary?: boolean;
}) {
  const pct = Math.min(100, (mission.progresso_atual / Math.max(1, mission.progresso_alvo)) * 100);
  return (
    <div
      className={`rounded-lg border p-4 ${
        secondary ? "border-border bg-surface/60" : "border-hero/30 bg-hero/5"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {mission.kind === "principal" ? "Principal" : "Secundária"}
          </p>
          <p className="font-medium">{mission.titulo}</p>
          <p className="mt-1 text-xs text-muted-foreground">{mission.descricao}</p>
        </div>
        <span className="shrink-0 text-xs text-hero">+{mission.xp_recompensa} XP</span>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>
            {mission.progresso_atual}/{mission.progresso_alvo}
          </span>
          <span>{Math.round(pct)}%</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>
    </div>
  );
}
