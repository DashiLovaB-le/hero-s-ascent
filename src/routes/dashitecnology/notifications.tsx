import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { adminNotificationsOverview } from "@/admin/functions";
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

export const Route = createFileRoute("/dashitecnology/notifications")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "notifications"],
      queryFn: () => runQueryFn(() => adminNotificationsOverview(), "Falha notificações."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => <AdminError error={error instanceof Error ? error : new Error(String(error))} />,
  component: NotificationsAdminPage,
});

function NotificationsAdminPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "notifications"],
    queryFn: () => runQueryFn(() => adminNotificationsOverview(), "Falha notificações."),
  });

  return (
    <AdminShell title="Notificações" subtitle="Inbox in-app (últimas 150).">
      <StatGrid>
        <StatCard label="Listadas" value={data.notifications.length} />
        <StatCard label="Não lidas (amostra)" value={data.unread} />
        <StatCard
          label="Tipos"
          value={Object.keys(data.byTipo).length}
          hint={Object.entries(data.byTipo)
            .map(([k, v]) => `${k}:${v}`)
            .join(" · ")}
        />
      </StatGrid>
      <Panel className="mt-6">
        <AdminTable headers={["Tipo", "Título", "User", "Lida", "Quando"]}>
          {data.notifications.map((n) => (
            <tr key={n.id} className="text-white/75">
              <td className="px-2 py-1.5">{n.tipo}</td>
              <td className="px-2 py-1.5">{n.titulo}</td>
              <td className="px-2 py-1.5 text-xs">{shortId(n.user_id)}</td>
              <td className="px-2 py-1.5">{n.lido_em ? "sim" : "não"}</td>
              <td className="px-2 py-1.5 text-xs">{n.created_at.slice(0, 16)}</td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </AdminShell>
  );
}
