import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
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
import { adminPageViewsOverview } from "@/lib/page-views.functions";

export const Route = createFileRoute("/dashitecnology/traffic")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "traffic"],
      queryFn: () =>
        runQueryFn(() => adminPageViewsOverview(), "Falha ao carregar acessos."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => (
    <AdminError error={error instanceof Error ? error : new Error(String(error))} />
  ),
  component: TrafficAdminPage,
});

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function DailyBars({ daily }: { daily: { day: string; count: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.count));
  return (
    <div className="flex h-36 items-end gap-1.5">
      {daily.map((d) => {
        const h = Math.round((d.count / max) * 100);
        const label = d.day.slice(5).replace("-", "/");
        return (
          <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-[10px] text-white/40">{d.count || ""}</span>
            <div
              className="w-full rounded-t bg-[#FC6E20]/80 transition-[height]"
              style={{ height: `${Math.max(d.count > 0 ? 8 : 2, h)}%` }}
              title={`${d.day}: ${d.count}`}
            />
            <span className="truncate text-[9px] text-white/35">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function TrafficAdminPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "traffic"],
    queryFn: () =>
      runQueryFn(() => adminPageViewsOverview(), "Falha ao carregar acessos."),
  });

  return (
    <AdminShell
      title="Acessos"
      subtitle="Page views da divulgação e do beta — por rota, sessão e dia."
    >
      <StatGrid>
        <StatCard label="Hoje" value={data.today} />
        <StatCard label="7 dias" value={data.last7d} hint={`${data.uniqueSessions7d} sessões`} />
        <StatCard label="30 dias" value={data.last30d} hint={`${data.uniqueSessions30d} sessões`} />
        <StatCard label="Total" value={data.total} />
      </StatGrid>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Últimos 14 dias">
          <DailyBars daily={data.daily} />
        </Panel>

        <Panel title="Top rotas (30d)">
          {data.byPath.length === 0 ? (
            <p className="text-sm text-white/45">Ainda sem acessos registrados.</p>
          ) : (
            <AdminTable headers={["Rota", "Views"]}>
              {data.byPath.map((row) => (
                <tr key={row.path}>
                  <td className="px-2 py-2 font-mono text-xs text-white/80">{row.path}</td>
                  <td className="px-2 py-2 text-white">{row.count}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </Panel>
      </div>

      <Panel title="Acessos recentes" className="mt-4">
        {data.recent.length === 0 ? (
          <p className="text-sm text-white/45">Nenhum evento ainda.</p>
        ) : (
          <AdminTable headers={["Quando", "Rota", "Sessão", "Referrer"]}>
            {data.recent.map((r) => (
              <tr key={r.id}>
                <td className="px-2 py-2 text-white/60">{formatWhen(r.created_at)}</td>
                <td className="px-2 py-2 font-mono text-xs text-white/80">{r.path}</td>
                <td className="px-2 py-2 font-mono text-xs text-white/45">
                  {shortId(r.session_id)}
                </td>
                <td className="max-w-[220px] truncate px-2 py-2 text-xs text-white/40">
                  {r.referrer || "—"}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </Panel>
    </AdminShell>
  );
}
