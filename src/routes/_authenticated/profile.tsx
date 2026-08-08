import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Swords, Trophy, Target, CalendarDays, Pencil, MapPin, History } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

import { updateProfile } from "@/lib/journey.functions";
import { updateAccountAuth } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  profilePanoramaQueryOptions,
  activityHistoryInfiniteQueryOptions,
  type JourneyData,
  type ProfilePanoramaData,
} from "@/lib/journey-queries";
import { calcularNivel, ATRIBUTO_LABELS, CATEGORIAS } from "@/lib/journey";
import { readStoredWallpaperId } from "@/lib/wallpaper-storage";
import { WallpaperSettings } from "@/components/WallpaperSettings";
import { TelegramSettingsCard } from "@/notifications/TelegramSettingsCard";
import { PushSettingsCard } from "@/notifications/PushSettingsCard";
import { CharlieAlarmSettingsCard } from "@/components/CharlieAlarmSettingsCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

const CHAPTER_NAMES = [
  "O Chamado",
  "A Travessia",
  "As Provas",
  "O Abismo",
  "A Recompensa",
  "O Retorno",
  "A Lenda",
];

const WEEKDAY_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];

export const Route = createFileRoute("/_authenticated/profile")({
  ssr: false,
  loader: async ({ context }) => {
    try {
      await Promise.all([
        context.queryClient.ensureQueryData(profilePanoramaQueryOptions()),
        context.queryClient.ensureInfiniteQueryData(activityHistoryInfiniteQueryOptions()),
      ]);
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e ?? "Falha ao carregar o perfil"));
    }
  },
  pendingComponent: () => (
    <div className="space-y-6 animate-pulse">
      <div className="h-40 bg-surface" />
      <div className="h-64 bg-surface" />
      <div className="h-40 bg-surface" />
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="cp-panel border border-transparent bg-destructive/10 p-6 text-sm text-destructive">
      {error instanceof Error ? error.message : String(error ?? "Erro ao abrir o perfil")}
    </div>
  ),
  notFoundComponent: () => <div>Não encontrado</div>,
  component: ProfilePage,
});

function ProfilePage() {
  const { data } = useSuspenseQuery(profilePanoramaQueryOptions());
  const updateFn = useServerFn(updateProfile);
  const updateAuthFn = useServerFn(updateAccountAuth);
  const qc = useQueryClient();

  const [nome, setNome] = useState(data.profile.nome ?? "");
  const [bio, setBio] = useState(data.profile.bio ?? "");
  const [email, setEmail] = useState(() => data.account.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [locationQuery, setLocationQuery] = useState(
    () => (data.profile as { location_label?: string | null }).location_label ?? "",
  );
  const [wallpaperId, setWallpaperId] = useState(() => readStoredWallpaperId());

  const locationLabel = (data.profile as { location_label?: string | null }).location_label ?? null;

  const m = useMutation({
    mutationFn: async () => {
      const currentEmail = (data.account.email ?? "").toLowerCase();
      const nextEmail = email.trim().toLowerCase();
      const wantsEmail = nextEmail.length > 0 && nextEmail !== currentEmail;
      const wantsPassword = newPassword.trim().length > 0;

      if (wantsPassword && newPassword !== confirmPassword) {
        throw new Error("A confirmação da nova senha não confere.");
      }
      if (wantsPassword && newPassword.trim().length < 6) {
        throw new Error("Nova senha: mínimo 6 caracteres.");
      }
      if ((wantsEmail || wantsPassword) && data.account.hasPassword && !currentPassword) {
        throw new Error("Informe a senha atual para alterar e-mail ou senha.");
      }

      const profileRes = await updateFn({
        data: {
          nome,
          bio,
          location_query: locationQuery,
        },
      });

      let authRes: {
        email: string | null;
        emailChanged: boolean;
        passwordChanged: boolean;
      } | null = null;

      if (wantsEmail || wantsPassword) {
        authRes = await updateAuthFn({
          data: {
            email: nextEmail || undefined,
            current_password: currentPassword || undefined,
            new_password: newPassword || undefined,
            confirm_password: confirmPassword || undefined,
          },
        });
        try {
          await supabase.auth.refreshSession();
        } catch {
          /* sessão antiga ainda vale; e-mail no JWT atualiza no próximo refresh */
        }
      }

      return { profileRes, authRes };
    },
    onSuccess: (res) => {
      const parts = ["Perfil atualizado"];
      if (res.authRes?.emailChanged) parts.push("e-mail alterado");
      if (res.authRes?.passwordChanged) parts.push("senha alterada");
      toast.success(parts.join(" · "));

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (res.authRes?.email) setEmail(res.authRes.email);

      const nextLabel =
        res.profileRes.location_label !== undefined ? res.profileRes.location_label : locationLabel;
      if (typeof nextLabel === "string") setLocationQuery(nextLabel);
      if (nextLabel === null) setLocationQuery("");

      qc.setQueryData<ProfilePanoramaData>(["profile-panorama"], (old) =>
        old
          ? {
              ...old,
              profile: {
                ...old.profile,
                nome,
                bio,
                location_label: nextLabel ?? null,
              },
              account: {
                ...old.account,
                email: res.authRes?.email ?? old.account.email,
                hasPassword: Boolean(old.account.hasPassword || res.authRes?.passwordChanged),
              },
            }
          : old,
      );
      qc.setQueryData<JourneyData>(["journey"], (old) =>
        old?.profile
          ? {
              ...old,
              profile: {
                ...old.profile,
                nome,
                bio,
              },
            }
          : old,
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const level = calcularNivel(data.profile.xp_total, data.levels);
  const chapterName = CHAPTER_NAMES[data.profile.capitulo_atual - 1] ?? "O Chamado";

  const attrEntries = Object.entries(ATRIBUTO_LABELS).map(([key, label]) => ({
    key,
    label,
    value: Number((data.attributes as Record<string, unknown>)[key] ?? 1),
  }));
  const sortedAttrs = [...attrEntries].sort((a, b) => b.value - a.value);
  const strongest = sortedAttrs[0];
  const weakest = sortedAttrs[sortedAttrs.length - 1];
  const radarMax = Math.max(5, ...attrEntries.map((a) => a.value));

  const radarData = attrEntries.map((a) => ({
    atributo: a.label,
    valor: a.value,
    fullMark: radarMax,
  }));

  const maxDayCount = Math.max(1, ...data.rhythm.days.map((d) => d.count));

  return (
    <div className="space-y-6">
      {/* 1. Identidade */}
      <Card className="cp-brackets overflow-hidden border-transparent bg-hero-glow p-6 shadow-elevated">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-hero text-hero-foreground shadow-hero">
              <span className="font-display text-3xl font-bold">{level.atual.nivel}</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-hero">{level.atual.titulo}</p>
              <h1 className="font-display text-2xl font-bold">{data.profile.nome}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Capítulo {data.profile.capitulo_atual} — {chapterName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 border border-strength/30 bg-strength/10 px-3 py-1.5 text-strength">
            <img
              src="/animate-icons/flame.gif"
              alt=""
              aria-hidden
              className="h-4 w-4 shrink-0 object-contain"
            />
            <span className="text-sm font-semibold">{data.profile.streak_atual}</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <StatCell label="XP" value={data.profile.xp_total.toLocaleString("pt-BR")} />
          <StatCell label="Dias na jornada" value={String(data.daysOnJourney)} />
          <StatCell label="Streak máx." value={String(data.profile.streak_maximo)} />
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              {data.profile.xp_total.toLocaleString("pt-BR")} XP
            </span>
            {level.proximo ? (
              <span className="text-xs text-muted-foreground">
                {level.xp_para_proximo.toLocaleString("pt-BR")} para {level.proximo.titulo}
              </span>
            ) : (
              <span className="text-xs text-hero">Nível máximo</span>
            )}
          </div>
          <Progress value={level.progresso * 100} className="h-2" />
        </div>

        {data.profile.bio ? (
          <p className="mt-5 border-l-2 border-hero pl-4 text-sm italic text-muted-foreground">
            {data.profile.bio}
          </p>
        ) : null}

        {locationLabel ? (
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-hero" />
            {locationLabel}
            <span className="text-muted-foreground/70">· Charlie usa o clima desta região</span>
          </p>
        ) : null}
      </Card>

      {/* 2. Radar de atributos */}
      <Card className="border-transparent p-6">
        <h2 className="font-display text-lg font-semibold">Atributos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mais forte: <span className="text-hero">{strongest?.label}</span>
          {" · "}
          Em evolução: <span className="text-foreground">{weakest?.label}</span>
        </p>

        <div className="mx-auto mt-2 h-[280px] w-full min-w-0 max-w-md">
          <ResponsiveContainer width="100%" height={280} minWidth={0}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
              <PolarGrid stroke="color-mix(in srgb, #FFE7D0 18%, transparent)" />
              <PolarAngleAxis dataKey="atributo" tick={{ fill: "#FFE7D099", fontSize: 10 }} />
              <PolarRadiusAxis angle={90} domain={[0, radarMax]} tick={false} axisLine={false} />
              <Radar
                name="Atributos"
                dataKey="valor"
                stroke="#FC6E20"
                fill="#FC6E20"
                fillOpacity={0.35}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {attrEntries.map((a) => (
            <div key={a.key} className="bg-surface px-3 py-2 text-center">
              <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                {a.label}
              </p>
              <p className="font-display text-xl font-bold text-hero">{a.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* 3. Ritmo */}
      <Card className="border-transparent p-6">
        <div className="mb-1 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-hero" />
          <h2 className="font-display text-lg font-semibold">Ritmo · 21 dias</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Mapa de dias ativos e consistência nos hábitos.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <StatCell label="Taxa" value={`${data.rhythm.completionRate}%`} />
          <StatCell
            label="Dias ativos"
            value={`${data.rhythm.activeDays}/${data.rhythm.periodDays}`}
          />
          <StatCell label="Melhor sequência" value={String(data.rhythm.bestStreakInPeriod)} />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex justify-between px-0.5 text-[0.65rem] text-muted-foreground">
            {WEEKDAY_SHORT.map((w, i) => (
              <span key={`${w}-${i}`} className="w-[calc((100%-20px)/7)] text-center">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {data.rhythm.days.map((d) => {
              const intensity = d.count === 0 ? 0 : Math.max(0.25, d.count / maxDayCount);
              return (
                <div
                  key={d.dia}
                  title={`${d.label}: ${d.count} hábito${d.count === 1 ? "" : "s"}`}
                  className="aspect-square border border-border/40"
                  style={{
                    background:
                      d.count === 0
                        ? "color-mix(in srgb, #323232 80%, transparent)"
                        : `color-mix(in srgb, #FC6E20 ${Math.round(intensity * 100)}%, #323232)`,
                  }}
                />
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {data.rhythm.totalCompletions} conclusões · {data.rhythm.habitCount}{" "}
            {data.rhythm.habitCount === 1 ? "hábito ativo" : "hábitos ativos"}
          </p>
        </div>
      </Card>

      {/* 4. Troféus */}
      <Card className="border-transparent p-6">
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <Trophy className="h-4 w-4 text-hero" /> Troféus da jornada
        </h2>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Target className="h-3.5 w-3.5" /> Metas ativas
            </h3>
            <Link to="/goals" className="text-xs text-hero hover:underline">
              Gerenciar
            </Link>
          </div>
          {data.goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma meta ativa.</p>
          ) : (
            <ul className="space-y-2">
              {data.goals.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-3 bg-surface px-3 py-2"
                >
                  <span className="truncate text-sm">{g.titulo}</span>
                  <span className="shrink-0 text-[0.65rem] uppercase tracking-wider text-hero">
                    {CATEGORIAS.find((c) => c.id === g.categoria)?.nome ?? g.categoria}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Swords className="h-3.5 w-3.5" /> Desafios do Charlie
            </h3>
            <Link to="/mentor" className="text-xs text-hero hover:underline">
              Abrir Charlie
            </Link>
          </div>
          {data.completedChallenges.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum desafio concluído ainda.</p>
          ) : (
            <ul className="space-y-2">
              {data.completedChallenges.map((c) => (
                <li
                  key={c.id}
                  className="cp-panel flex items-center gap-3 border border-transparent bg-surface/80 px-4 py-3"
                >
                  <Check className="h-4 w-4 shrink-0 text-hero" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      +{c.xp_recompensa} XP
                      {c.completed_at
                        ? ` · ${new Date(c.completed_at).toLocaleDateString("pt-BR")}`
                        : ""}
                      {c.titulo_recompensa ? ` · ${c.titulo_recompensa}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" /> Conquistas
          </h3>
          {data.achievements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Continue a jornada para desbloquear conquistas.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.achievements.map((a) => {
                const ach = (
                  a as {
                    achievements: { titulo: string; descricao: string } | null;
                  }
                ).achievements;
                return (
                  <li key={a.achievement_id} className="border border-border bg-surface px-3 py-2">
                    <p className="text-sm font-medium">{ach?.titulo}</p>
                    <p className="text-xs text-muted-foreground">{ach?.descricao}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-6 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Histórico de atividade
          </h3>
          <ActivityHistorySection />
        </section>
      </Card>

      <Card className="border-transparent p-6">
        <PushSettingsCard />
      </Card>

      <Card className="border-transparent p-6">
        <CharlieAlarmSettingsCard />
      </Card>

      <Card className="border-transparent p-6">
        <TelegramSettingsCard />
      </Card>

      <Card className="border-transparent p-6">
        <WallpaperSettings
          selectedId={wallpaperId}
          onSelect={setWallpaperId}
          progress={{
            xp_total: data.profile.xp_total,
            streak_maximo: data.profile.streak_maximo,
            capitulo_atual: data.profile.capitulo_atual,
          }}
          wallpapers={data.wallpapers}
          levels={data.levels}
        />
      </Card>

      {/* Editar perfil — no final */}
      <Card className="border-transparent p-6">
        <h2 className="mb-4 flex items-center gap-2 font-display font-semibold">
          <Pencil className="h-4 w-4 text-hero" /> Editar perfil
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              minLength={2}
              maxLength={60}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">E-mail</Label>
            <Input
              id="profile-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-current-password">
              {data.account.hasPassword ? "Senha atual" : "Senha atual (opcional)"}
            </Label>
            <Input
              id="profile-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              maxLength={72}
              placeholder={
                data.account.hasPassword
                  ? "Obrigatória para mudar e-mail ou senha"
                  : "Conta Google — só necessária se já tiver senha"
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-new-password">Nova senha</Label>
              <Input
                id="profile-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                maxLength={72}
                placeholder="Deixe em branco para manter"
                minLength={newPassword ? 6 : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-confirm-password">Confirmar nova senha</Label>
              <Input
                id="profile-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                maxLength={72}
                placeholder="Repita a nova senha"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Alterar e-mail ou senha atualiza a conta no Supabase Auth. Mínimo 6 caracteres na nova
            senha.
          </p>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Cidade / região (clima do Charlie)</Label>
            <Input
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              placeholder="Ex.: São Paulo, Curitiba, Recife…"
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">
              Charlie usa a previsão do tempo desta região (Open-Meteo). Deixe em branco e salve
              para remover.
            </p>
          </div>
          <Button type="submit" disabled={m.isPending} className="rounded-none shadow-hero">
            Salvar
          </Button>
        </form>
      </Card>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface/80 px-2 py-3">
      <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold text-hero sm:text-xl">{value}</p>
    </div>
  );
}

function ActivityHistorySection() {
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useSuspenseInfiniteQuery(
    activityHistoryInfiniteQueryOptions(),
  );

  const items = data.pages.flatMap((p) => p.items);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Suas ações aparecem aqui quando você concluir hábitos e desafios.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ActivityTimeline items={items} />
      {hasNextPage && (
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-none"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage ? "Carregando…" : "Carregar mais"}
        </Button>
      )}
      {!hasNextPage && items.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">Fim do histórico</p>
      )}
    </div>
  );
}

function ActivityTimeline({
  items,
}: {
  items: Array<{
    id: string;
    tipo: string;
    descricao: string;
    xp_delta: number;
    created_at: string;
  }>;
}) {
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const day = new Date(item.created_at).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
    const list = groups.get(day) ?? [];
    list.push(item);
    groups.set(day, list);
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([day, rows]) => (
        <div key={day}>
          <p className="mb-2 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
            {day}
          </p>
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 border border-border bg-surface/80 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm">{row.descricao}</p>
                  <p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                    {row.tipo.replace(/_/g, " ")}
                  </p>
                </div>
                {row.xp_delta !== 0 && (
                  <span className="shrink-0 text-xs font-medium text-hero">
                    {row.xp_delta > 0 ? "+" : ""}
                    {row.xp_delta} XP
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
