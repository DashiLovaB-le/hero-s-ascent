import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { adminCheckinsOverview } from "@/admin/functions";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  AdminTable,
  Panel,
  StatCard,
  StatGrid,
  fmtNum,
  shortId,
} from "@/admin/ui";
import { runQueryFn } from "@/lib/safe-query";

export const Route = createFileRoute("/dashitecnology/checkins")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "checkins"],
      queryFn: () => runQueryFn(() => adminCheckinsOverview(), "Falha check-ins."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => <AdminError error={error instanceof Error ? error : new Error(String(error))} />,
  component: CheckinsAdminPage,
});

function CheckinsAdminPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "checkins"],
    queryFn: () => runQueryFn(() => adminCheckinsOverview(), "Falha check-ins."),
  });

  return (
    <AdminShell title="Check-ins" subtitle="Últimos 100 check-ins.">
      <StatGrid>
        <StatCard label="Amostra" value={data.count} />
        <StatCard label="Humor médio" value={fmtNum(data.avgHumor, 1)} />
        <StatCard label="Energia média" value={fmtNum(data.avgEnergia, 1)} />
      </StatGrid>
      <Panel className="mt-6">
        <AdminTable headers={["Dia", "User", "Humor", "Energia", "Sono", "Nota"]}>
          {data.checkins.map((c) => (
            <tr key={c.id} className="text-white/75">
              <td className="px-2 py-1.5">{c.dia}</td>
              <td className="px-2 py-1.5 text-xs">{shortId(c.user_id)}</td>
              <td className="px-2 py-1.5">{c.humor ?? "—"}</td>
              <td className="px-2 py-1.5">{c.energia ?? "—"}</td>
              <td className="px-2 py-1.5">
                {c.sono_horas ?? "—"}h / q{c.sono_qualidade ?? "—"}
              </td>
              <td className="max-w-[200px] truncate px-2 py-1.5 text-xs">{c.nota ?? ""}</td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </AdminShell>
  );
}
