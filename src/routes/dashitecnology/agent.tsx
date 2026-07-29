import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminAgentOverview, adminCancelInitiative } from "@/admin/functions";
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
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashitecnology/agent")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "agent"],
      queryFn: () => runQueryFn(() => adminAgentOverview(), "Falha agente."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => <AdminError error={error instanceof Error ? error : new Error(String(error))} />,
  component: AgentAdminPage,
});

function AgentAdminPage() {
  const qc = useQueryClient();
  const cancelFn = useServerFn(adminCancelInitiative);
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "agent"],
    queryFn: () => runQueryFn(() => adminAgentOverview(), "Falha agente."),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Iniciativa cancelada");
      void qc.invalidateQueries({ queryKey: ["admin", "agent"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Agente" subtitle="Iniciativas e recomendações CF.">
      <StatGrid>
        <StatCard label="Iniciativas" value={data.initiatives.length} />
        <StatCard
          label="Status"
          value={Object.keys(data.byStatus).length}
          hint={Object.entries(data.byStatus)
            .map(([k, v]) => `${k}:${v}`)
            .join(" · ")}
        />
        <StatCard
          label="Kinds"
          value={Object.keys(data.byKind).length}
          hint={Object.entries(data.byKind)
            .map(([k, v]) => `${k}:${v}`)
            .join(" · ")}
        />
        <StatCard label="CF recs" value={data.cfRecs.length} />
      </StatGrid>

      <Panel className="mt-6" title="Iniciativas">
        <AdminTable headers={["Título", "User", "Kind", "Status", ""]}>
          {data.initiatives.map((row) => (
            <tr key={row.id} className="text-white/75">
              <td className="px-2 py-1.5">{row.titulo}</td>
              <td className="px-2 py-1.5 text-xs">{shortId(row.user_id)}</td>
              <td className="px-2 py-1.5">{row.kind}</td>
              <td className="px-2 py-1.5">{row.status}</td>
              <td className="px-2 py-1.5">
                {row.status === "pending" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(row.id)}
                  >
                    Cancelar
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </AdminTable>
      </Panel>

      <Panel className="mt-4" title="CF recommendations">
        <AdminTable headers={["User", "Peers", "Modelo", "Quando"]}>
          {data.cfRecs.map((r) => (
            <tr key={`${r.user_id}-${r.computed_at}`} className="text-white/75">
              <td className="px-2 py-1.5 text-xs">{shortId(r.user_id)}</td>
              <td className="px-2 py-1.5">{r.peer_count}</td>
              <td className="px-2 py-1.5 text-xs">{r.model_version}</td>
              <td className="px-2 py-1.5 text-xs">{r.computed_at?.slice(0, 16)}</td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </AdminShell>
  );
}
