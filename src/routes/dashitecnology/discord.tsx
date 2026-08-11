import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminDiscordOverview, adminUnlinkDiscord } from "@/admin/functions";
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

export const Route = createFileRoute("/dashitecnology/discord")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "discord"],
      queryFn: () => runQueryFn(() => adminDiscordOverview(), "Falha discord."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => (
    <AdminError error={error instanceof Error ? error : new Error(String(error))} />
  ),
  component: DiscordAdminPage,
});

function DiscordAdminPage() {
  const qc = useQueryClient();
  const unlinkFn = useServerFn(adminUnlinkDiscord);
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "discord"],
    queryFn: () => runQueryFn(() => adminDiscordOverview(), "Falha discord."),
  });

  const unlink = useMutation({
    mutationFn: (userId: string) => unlinkFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Discord desvinculado");
      void qc.invalidateQueries({ queryKey: ["admin", "discord"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Discord" subtitle="Contas com discord_user_id vinculado (DM).">
      <StatGrid>
        <StatCard label="Linkados" value={data.linked} />
        <StatCard label="Opt-in" value={data.optIn} />
      </StatGrid>
      <Panel className="mt-6">
        <AdminTable headers={["Nome", "User", "Discord ID", "Opt-in", ""]}>
          {data.links.map((row) => (
            <tr key={row.id} className="text-white/75">
              <td className="px-2 py-1.5">{row.nome}</td>
              <td className="px-2 py-1.5 text-xs">{shortId(row.id)}</td>
              <td className="px-2 py-1.5 text-xs">{row.discord_user_id}</td>
              <td className="px-2 py-1.5">{row.discord_opt_in ? "sim" : "não"}</td>
              <td className="px-2 py-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={unlink.isPending}
                  onClick={() => unlink.mutate(row.id)}
                >
                  Unlink
                </Button>
              </td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </AdminShell>
  );
}
