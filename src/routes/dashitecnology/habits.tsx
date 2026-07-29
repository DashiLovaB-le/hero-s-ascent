import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { adminListHabits } from "@/admin/functions";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  AdminTable,
  Panel,
  StatCard,
  StatGrid,
  shortId,
} from "@/admin/ui";
import { runQueryFn } from "@/lib/safe-query";

export const Route = createFileRoute("/dashitecnology/habits")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "habits"],
      queryFn: () => runQueryFn(() => adminListHabits(), "Falha hábitos."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => <AdminError error={error instanceof Error ? error : new Error(String(error))} />,
  component: HabitsAdminPage,
});

function HabitsAdminPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "habits"],
    queryFn: () => runQueryFn(() => adminListHabits(), "Falha hábitos."),
  });

  return (
    <AdminShell title="Hábitos" subtitle="Últimos 200 hábitos no sistema.">
      <StatGrid>
        <StatCard label="Listados" value={data.stats.total} />
        <StatCard label="Ativos" value={data.stats.active} />
        <StatCard label="Completions hoje" value={data.stats.completionsToday} />
        <StatCard
          label="Por atributo"
          value={Object.keys(data.stats.byAttr).length}
          hint={Object.entries(data.stats.byAttr)
            .map(([k, v]) => `${k}:${v}`)
            .join(" · ")}
        />
      </StatGrid>
      <Panel className="mt-6">
        <AdminTable headers={["Título", "User", "Atributo", "XP", "Ativo"]}>
          {data.habits.map((h) => (
            <tr key={h.id} className="text-white/75">
              <td className="px-2 py-1.5">{h.titulo}</td>
              <td className="px-2 py-1.5 text-xs">{shortId(h.user_id)}</td>
              <td className="px-2 py-1.5">{h.atributo}</td>
              <td className="px-2 py-1.5">{h.xp_recompensa}</td>
              <td className="px-2 py-1.5">{h.ativo ? "sim" : "não"}</td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </AdminShell>
  );
}
