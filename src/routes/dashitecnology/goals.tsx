import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { adminListGoals } from "@/admin/functions";
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

export const Route = createFileRoute("/dashitecnology/goals")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "goals"],
      queryFn: () => runQueryFn(() => adminListGoals(), "Falha metas."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => <AdminError error={error instanceof Error ? error : new Error(String(error))} />,
  component: GoalsAdminPage,
});

function GoalsAdminPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "goals"],
    queryFn: () => runQueryFn(() => adminListGoals(), "Falha metas."),
  });

  return (
    <AdminShell title="Metas" subtitle="Últimas 200 metas.">
      <StatGrid>
        <StatCard label="Listadas" value={data.goals.length} />
        <StatCard label="Ativas" value={data.active} />
        <StatCard
          label="Categorias"
          value={Object.keys(data.byCat).length}
          hint={Object.entries(data.byCat)
            .map(([k, v]) => `${k}:${v}`)
            .join(" · ")}
        />
      </StatGrid>
      <Panel className="mt-6">
        <AdminTable headers={["Título", "User", "Categoria", "Ativa"]}>
          {data.goals.map((g) => (
            <tr key={g.id} className="text-white/75">
              <td className="px-2 py-1.5">{g.titulo}</td>
              <td className="px-2 py-1.5 text-xs">{shortId(g.user_id)}</td>
              <td className="px-2 py-1.5">{g.categoria}</td>
              <td className="px-2 py-1.5">{g.ativo ? "sim" : "não"}</td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </AdminShell>
  );
}
