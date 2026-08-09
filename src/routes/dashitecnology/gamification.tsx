import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { adminGamification, adminSetHabitXpReward } from "@/admin/functions";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  AdminTable,
  Panel,
  shortId,
} from "@/admin/ui";
import { runQueryFn } from "@/lib/safe-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HABIT_XP_DEFAULT, HABIT_XP_MAX, HABIT_XP_MIN } from "@/lib/habit-xp";

export const Route = createFileRoute("/dashitecnology/gamification")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "gamification"],
      queryFn: () => runQueryFn(() => adminGamification(), "Falha gamificação."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => (
    <AdminError error={error instanceof Error ? error : new Error(String(error))} />
  ),
  component: GamificationPage,
});

function GamificationPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(adminGamification);
  const setXpFn = useServerFn(adminSetHabitXpReward);

  const { data } = useSuspenseQuery({
    queryKey: ["admin", "gamification"],
    queryFn: () => runQueryFn(() => getFn(), "Falha gamificação."),
  });

  const [xp, setXp] = useState(data.habitXpReward ?? HABIT_XP_DEFAULT);

  const saveXp = useMutation({
    mutationFn: () =>
      setXpFn({
        data: { xp, syncExisting: true },
      }),
    onSuccess: async (r) => {
      setXp(r.habitXpReward);
      await qc.invalidateQueries({ queryKey: ["admin", "gamification"] });
      toast.success(`XP por hábito = ${r.habitXpReward} (hábitos sincronizados).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Gamificação" subtitle="Leaderboard, wallpapers e economia de XP.">
      <Panel title="XP fixo por hábito" className="mb-4">
        <p className="mb-3 text-sm text-white/55">
          Heróis não escolhem XP. Todo check de hábito (exceto exercício validado) usa este valor.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <Label htmlFor="habit-xp">XP por check</Label>
            <Input
              id="habit-xp"
              type="number"
              min={HABIT_XP_MIN}
              max={HABIT_XP_MAX}
              value={xp}
              onChange={(e) => setXp(Number(e.target.value))}
              className="w-28"
            />
          </div>
          <Button disabled={saveXp.isPending} onClick={() => saveXp.mutate()}>
            Salvar e sincronizar
          </Button>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Top XP">
          <AdminTable headers={["#", "Nome", "XP", "Cap.", "Streak"]}>
            {data.leaderboard.map((row, i) => (
              <tr key={row.userId} className="text-white/75">
                <td className="px-2 py-1.5">{i + 1}</td>
                <td className="px-2 py-1.5">{row.displayName || shortId(row.userId)}</td>
                <td className="px-2 py-1.5">{row.xpTotal}</td>
                <td className="px-2 py-1.5">{row.chapter}</td>
                <td className="px-2 py-1.5">
                  {row.streakCurrent}/{row.streakMax}
                </td>
              </tr>
            ))}
          </AdminTable>
        </Panel>
        <Panel title="Wallpapers (catálogo)">
          <AdminTable headers={["ID", "Título", "Unlock", "Uso"]}>
            {data.wallpaperCatalog.map((w) => (
              <tr key={w.id} className="text-white/75">
                <td className="px-2 py-1.5">{w.id}</td>
                <td className="px-2 py-1.5">{w.titulo}</td>
                <td className="px-2 py-1.5 text-xs">
                  {w.unlock.kind}
                  {"min" in w.unlock ? ` ≥${w.unlock.min}` : ""}
                </td>
                <td className="px-2 py-1.5">{w.usage}</td>
              </tr>
            ))}
          </AdminTable>
        </Panel>
      </div>
    </AdminShell>
  );
}
