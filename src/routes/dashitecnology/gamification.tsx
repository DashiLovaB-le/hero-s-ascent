import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { adminGamification } from "@/admin/functions";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  AdminTable,
  Panel,
  shortId,
} from "@/admin/ui";
import { runQueryFn } from "@/lib/safe-query";

export const Route = createFileRoute("/dashitecnology/gamification")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "gamification"],
      queryFn: () => runQueryFn(() => adminGamification(), "Falha gamificação."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => <AdminError error={error instanceof Error ? error : new Error(String(error))} />,
  component: GamificationPage,
});

function GamificationPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "gamification"],
    queryFn: () => runQueryFn(() => adminGamification(), "Falha gamificação."),
  });

  return (
    <AdminShell title="Gamificação" subtitle="Leaderboard e wallpapers.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Top XP">
          <AdminTable headers={["#", "Nome", "XP", "Cap.", "Streak"]}>
            {data.leaderboard.map((row, i) => (
              <tr key={row.userId} className="text-white/75">
                <td className="px-2 py-1.5">{i + 1}</td>
                <td className="px-2 py-1.5">
                  {row.displayName || shortId(row.userId)}
                </td>
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
