import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { adminContentOverview } from "@/admin/functions";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  AdminTable,
  Panel,
} from "@/admin/ui";
import { runQueryFn } from "@/lib/safe-query";

export const Route = createFileRoute("/dashitecnology/content")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "content"],
      queryFn: () => runQueryFn(() => adminContentOverview(), "Falha conteúdo."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => <AdminError error={error instanceof Error ? error : new Error(String(error))} />,
  component: ContentAdminPage,
});

function ContentAdminPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "content"],
    queryFn: () => runQueryFn(() => adminContentOverview(), "Falha conteúdo."),
  });

  return (
    <AdminShell title="Conteúdo" subtitle={data.note}>
      <Panel title="Wallpapers">
        <AdminTable headers={["ID", "Título", "Arquivo", "Unlock"]}>
          {data.wallpapers.map((w) => (
            <tr key={w.id} className="text-white/75">
              <td className="px-2 py-1.5">{w.id}</td>
              <td className="px-2 py-1.5">{w.titulo}</td>
              <td className="px-2 py-1.5 text-xs">{w.file ?? "—"}</td>
              <td className="px-2 py-1.5 text-xs">
                {w.unlock.kind}
                {"min" in w.unlock ? ` ≥${w.unlock.min}` : ""}
              </td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </AdminShell>
  );
}
