import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { adminMlOverview } from "@/admin/functions";
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

export const Route = createFileRoute("/dashitecnology/ml")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "ml"],
      queryFn: () => runQueryFn(() => adminMlOverview(), "Falha ML."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => <AdminError error={error instanceof Error ? error : new Error(String(error))} />,
  component: MlAdminPage,
});

function MlAdminPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "ml"],
    queryFn: () => runQueryFn(() => adminMlOverview(), "Falha ML."),
  });

  return (
    <AdminShell title="ML" subtitle="Feature store, scores heuristic e shadow.">
      <StatGrid>
        <StatCard label="Features" value={data.featuresCount} />
        <StatCard label="Scores" value={data.scores.length} />
        <StatCard label="Shadow" value={data.shadow.length} />
        <StatCard label="Model runs" value={data.modelRuns.length} />
      </StatGrid>
      {(data.scoreError || data.shadowError) && (
        <p className="mt-3 text-sm text-amber-300">
          {[data.scoreError, data.shadowError].filter(Boolean).join(" · ")}
        </p>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Risco abandono (top)">
          <AdminTable headers={["User", "Abandono", "Streak", "Modelo"]}>
            {data.scores.map((s) => (
              <tr key={s.user_id} className="text-white/75">
                <td className="px-2 py-1.5 text-xs">{shortId(s.user_id)}</td>
                <td className="px-2 py-1.5">{fmtNum(s.risco_abandono)}</td>
                <td className="px-2 py-1.5">{fmtNum(s.risco_streak)}</td>
                <td className="px-2 py-1.5 text-xs">{s.model_version}</td>
              </tr>
            ))}
          </AdminTable>
        </Panel>
        <Panel title="Model runs">
          <AdminTable headers={["Versão", "AUC S", "AUC A", "Promoted"]}>
            {data.modelRuns.map((r) => (
              <tr key={r.id} className="text-white/75">
                <td className="px-2 py-1.5">{r.model_version}</td>
                <td className="px-2 py-1.5">{fmtNum(r.auc_streak)}</td>
                <td className="px-2 py-1.5">{fmtNum(r.auc_abandono)}</td>
                <td className="px-2 py-1.5">{r.promoted ? "sim" : "não"}</td>
              </tr>
            ))}
          </AdminTable>
        </Panel>
      </div>
      <Panel className="mt-4" title="Shadow scores recentes">
        <AdminTable headers={["User", "Abandono", "Streak", "Modelo", "Quando"]}>
          {data.shadow.map((s, i) => (
            <tr key={`${s.user_id}-${s.computed_at}-${i}`} className="text-white/75">
              <td className="px-2 py-1.5 text-xs">{shortId(s.user_id)}</td>
              <td className="px-2 py-1.5">{fmtNum(s.risco_abandono)}</td>
              <td className="px-2 py-1.5">{fmtNum(s.risco_streak)}</td>
              <td className="px-2 py-1.5 text-xs">{s.model_version}</td>
              <td className="px-2 py-1.5 text-xs">{s.computed_at?.slice(0, 16)}</td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </AdminShell>
  );
}
