import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { adminSystemOverview } from "@/admin/functions";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  Panel,
  StatCard,
  StatGrid,
} from "@/admin/ui";
import { runQueryFn } from "@/lib/safe-query";

export const Route = createFileRoute("/dashitecnology/system")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "system"],
      queryFn: () => runQueryFn(() => adminSystemOverview(), "Falha sistema."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => <AdminError error={error instanceof Error ? error : new Error(String(error))} />,
  component: SystemAdminPage,
});

function SystemAdminPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "system"],
    queryFn: () => runQueryFn(() => adminSystemOverview(), "Falha sistema."),
  });

  const flags = [
    ["Service role", data.envFlags.hasServiceRole],
    ["Segredo do cron", data.envFlags.hasCronSecret],
    ["Telegram token", data.envFlags.hasTelegramToken],
    ["OpenAI/OpenRouter", data.envFlags.hasOpenAi],
    ["Bootstrap email", data.envFlags.hasBootstrapEmail],
  ] as const;

  return (
    <AdminShell title="Sistema" subtitle="Ambiente e edge functions.">
      <StatGrid>
        <StatCard label="Project ref" value={data.projectRef || "—"} />
        <StatCard label="Edge functions" value={data.edgeFunctions.length} />
      </StatGrid>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Env flags (sem secrets)">
          <ul className="space-y-2 text-sm">
            {flags.map(([label, ok]) => (
              <li key={label} className="flex justify-between text-white/70">
                <span>{label}</span>
                <span className={ok ? "text-emerald-400" : "text-red-300"}>
                  {ok ? "ok" : "ausente"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 break-all text-xs text-white/35">{data.supabaseUrl}</p>
        </Panel>
        <Panel title="Edge functions">
          <ul className="space-y-2 text-sm text-white/70">
            {data.edgeFunctions.map((fn) => (
              <li key={fn} className="font-mono text-xs">
                {fn}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AdminShell>
  );
}
