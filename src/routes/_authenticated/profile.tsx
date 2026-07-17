import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { updateProfile } from "@/lib/journey.functions";
import { journeyQueryOptions, type JourneyData } from "@/lib/journey-queries";
import { calcularNivel, ATRIBUTO_LABELS } from "@/lib/journey";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/profile")({
  loader: ({ context }) => context.queryClient.ensureQueryData(journeyQueryOptions()),
  errorComponent: ({ error }) => <div className="p-6 text-destructive">{String(error)}</div>,
  notFoundComponent: () => <div>Não encontrado</div>,
  component: ProfilePage,
});

function ProfilePage() {
  const { data } = useSuspenseQuery(journeyQueryOptions());
  const updateFn = useServerFn(updateProfile);
  const qc = useQueryClient();

  const [nome, setNome] = useState(data.profile?.nome ?? "");
  const [bio, setBio] = useState(data.profile?.bio ?? "");

  const m = useMutation({
    mutationFn: () => updateFn({ data: { nome, bio } }),
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.setQueryData<JourneyData>(["journey"], (old) =>
        old?.profile ? { ...old, profile: { ...old.profile, nome, bio } } : old,
      );
    },
    onError: (e) => toast.error(e.message),
  });

  if (!data.profile || !data.attributes) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
        Não foi possível carregar seu perfil. Tente atualizar a página.
      </div>
    );
  }
  const level = calcularNivel(data.profile.xp_total);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-hero text-hero-foreground shadow-hero">
            <span className="font-display text-3xl font-bold">{level.atual.nivel}</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-hero">{level.atual.titulo}</p>
            <h1 className="font-display text-2xl font-bold">{data.profile.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {data.profile.xp_total.toLocaleString("pt-BR")} XP · Streak {data.profile.streak_atual} · Máx {data.profile.streak_maximo}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 font-display font-semibold">Editar perfil</h2>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} minLength={2} maxLength={60} />
          </div>
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} rows={3} />
          </div>
          <Button type="submit" disabled={m.isPending}>Salvar</Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 font-display font-semibold">Atributos</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(ATRIBUTO_LABELS).map(([key, label]) => {
            const val = (data.attributes as Record<string, number | string>)[key] as number;
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
          <h2 className="mb-4 font-display font-semibold">Conquistas</h2>
          <ul className="space-y-2">
            {data.achievements.map((a) => {
              const ach = (a as { achievements: { titulo: string; descricao: string } }).achievements;
              return (
                <li key={a.achievement_id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">{ach?.titulo}</p>
                  <p className="text-xs text-muted-foreground">{ach?.descricao}</p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
