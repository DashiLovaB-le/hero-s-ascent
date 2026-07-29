import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { adminCockpit } from "@/admin/functions";
import { AdminError, AdminLoading, AdminShell, Panel, StatCard, StatGrid, fmtNum } from "@/admin/ui";
import { runQueryFn } from "@/lib/safe-query";

export const Route = createFileRoute("/dashitecnology/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "cockpit"],
      queryFn: () => runQueryFn(() => adminCockpit(), "Falha no cockpit."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => <AdminError error={error instanceof Error ? error : new Error(String(error))} />,
  component: CockpitPage,
});

function CockpitPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "cockpit"],
    queryFn: () => runQueryFn(() => adminCockpit(), "Falha no cockpit."),
  });

  return (
    <AdminShell title="Cockpit" subtitle="Visão geral do V-Project em tempo real.">
      <StatGrid>
        <StatCard label="Heróis" value={data.users} />
        <StatCard label="Hábitos hoje" value={data.habitsToday} />
        <StatCard label="Notif. não lidas" value={data.notifUnread} />
        <StatCard label="Risco abandono ≥0.55" value={data.highRisk} hint="ML heuristic" />
        <StatCard label="Iniciativas pending" value={data.initiativesPending} />
        <StatCard label="Telegram linkados" value={data.telegramLinked} />
        <StatCard label="Check-ins hoje" value={data.checkinsToday} />
        <StatCard label="Shadow scores" value={data.shadowScores} />
      </StatGrid>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Atalhos">
          <div className="flex flex-wrap gap-2">
            {[
              ["/dashitecnology/users", "Heróis"],
              ["/dashitecnology/jobs", "Jobs"],
              ["/dashitecnology/ml", "ML"],
              ["/dashitecnology/agent", "Agente"],
              ["/dashitecnology/notifications", "Notificações"],
            ].map(([to, label]) => (
              <Link
                key={to}
                to={to}
                className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-white/70 hover:border-[#FC6E20]/40 hover:text-[#FC6E20]"
              >
                {label}
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Últimos model runs">
          {data.recentModelRuns.length === 0 ? (
            <p className="text-sm text-white/40">Nenhum run registrado.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.recentModelRuns.map((r) => (
                <li key={r.id} className="flex justify-between gap-2 text-white/70">
                  <span>{r.model_version}</span>
                  <span>
                    AUC streak {fmtNum(r.auc_streak)} · abandono {fmtNum(r.auc_abandono)}
                    {r.promoted ? " · promoted" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </AdminShell>
  );
}
