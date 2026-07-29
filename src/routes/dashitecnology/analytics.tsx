import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { adminAnalyticsOverview } from "@/admin/functions";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  StatCard,
  StatGrid,
} from "@/admin/ui";
import { runQueryFn } from "@/lib/safe-query";

export const Route = createFileRoute("/dashitecnology/analytics")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "analytics"],
      queryFn: () => runQueryFn(() => adminAnalyticsOverview(), "Falha analytics."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => <AdminError error={error instanceof Error ? error : new Error(String(error))} />,
  component: AnalyticsAdminPage,
});

function AnalyticsAdminPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () => runQueryFn(() => adminAnalyticsOverview(), "Falha analytics."),
  });

  return (
    <AdminShell title="Analytics" subtitle="Métricas agregadas (7d / total).">
      <StatGrid>
        <StatCard label="Usuários" value={data.usersTotal} />
        <StatCard label="Onboarded" value={data.onboarded} />
        <StatCard label="Completions 7d" value={data.habitCompletions7d} />
        <StatCard label="Notificações 7d" value={data.notifications7d} />
        <StatCard label="Check-ins 7d" value={data.checkins7d} />
        <StatCard label="Alto risco abandono" value={data.highChurnRisk} />
      </StatGrid>
    </AdminShell>
  );
}
