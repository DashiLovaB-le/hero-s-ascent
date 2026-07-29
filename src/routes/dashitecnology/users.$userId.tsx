import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminAdjustXp,
  adminRecomputeUserMl,
  adminSetUserRole,
  adminUserDetail,
} from "@/admin/functions";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  AdminTable,
  Panel,
  StatCard,
  StatGrid,
  fmtNum,
} from "@/admin/ui";
import { runQueryFn } from "@/lib/safe-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export const Route = createFileRoute("/dashitecnology/users/$userId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "user", params.userId],
      queryFn: () =>
        runQueryFn(
          () => adminUserDetail({ data: { userId: params.userId } }),
          "Falha ao carregar herói.",
        ),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => <AdminError error={error instanceof Error ? error : new Error(String(error))} />,
  component: UserDetailPage,
});

function UserDetailPage() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();
  const [xpDelta, setXpDelta] = useState("100");

  const { data } = useSuspenseQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () =>
      runQueryFn(() => adminUserDetail({ data: { userId } }), "Falha ao carregar herói."),
  });

  const roleFn = useServerFn(adminSetUserRole);
  const xpFn = useServerFn(adminAdjustXp);
  const mlFn = useServerFn(adminRecomputeUserMl);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "user", userId] });

  const grantAdmin = useMutation({
    mutationFn: () => roleFn({ data: { userId, role: "dashi", action: "grant" } }),
    onSuccess: () => {
      toast.success("Role dashi concedida");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeAdmin = useMutation({
    mutationFn: () => roleFn({ data: { userId, role: "dashi", action: "revoke" } }),
    onSuccess: () => {
      toast.success("Role dashi removida");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustXp = useMutation({
    mutationFn: () => xpFn({ data: { userId, delta: Number(xpDelta) || 0 } }),
    onSuccess: (r) => {
      toast.success(`XP agora: ${r.xpTotal}`);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recompute = useMutation({
    mutationFn: () => mlFn({ data: { userId } }),
    onSuccess: (r) => {
      toast.success(`ML ok — abandono ${fmtNum(r.riscoAbandono)}`);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const p = data.profile;
  if (!p) {
    return (
      <AdminShell title="Herói">
        <p className="text-sm text-white/50">Perfil não encontrado. {data.profileError}</p>
      </AdminShell>
    );
  }

  const isAdmin = data.roles.includes("dashi");

  return (
    <AdminShell
      title={p.nome || "Herói"}
      subtitle={userId}
      actions={
        <Link to="/dashitecnology/users" className="text-sm text-white/50 hover:text-white">
          ← Lista
        </Link>
      }
    >
      <StatGrid>
        <StatCard label="XP" value={p.xp_total} />
        <StatCard label="Capítulo" value={p.capitulo_atual} />
        <StatCard label="Streak" value={`${p.streak_atual}/${p.streak_maximo}`} />
        <StatCard
          label="Risco abandono"
          value={fmtNum(data.mlScore?.risco_abandono)}
          hint={data.mlScore?.model_version ?? "sem score"}
        />
      </StatGrid>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Ações">
          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <Button variant="outline" onClick={() => revokeAdmin.mutate()} disabled={revokeAdmin.isPending}>
                Remover dashi
              </Button>
            ) : (
              <Button onClick={() => grantAdmin.mutate()} disabled={grantAdmin.isPending}>
                Tornar dashi
              </Button>
            )}
            <Button variant="outline" onClick={() => recompute.mutate()} disabled={recompute.isPending}>
              Recomputar ML
            </Button>
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={xpDelta}
              onChange={(e) => setXpDelta(e.target.value)}
              className="max-w-[120px] border-white/10 bg-black/30"
            />
            <Button onClick={() => adjustXp.mutate()} disabled={adjustXp.isPending}>
              Ajustar XP
            </Button>
          </div>
          <p className="mt-2 text-xs text-white/40">
            Roles: {data.roles.join(", ") || "user"} · Telegram:{" "}
            {p.telegram_chat_id ? "linkado" : "não"} · Onboarding:{" "}
            {p.onboarding_completo ? "ok" : "pendente"}
          </p>
        </Panel>

        <Panel title="Atributos">
          {data.attributes ? (
            <div className="grid grid-cols-2 gap-2 text-sm text-white/70">
              {Object.entries(data.attributes)
                .filter(([k]) => k !== "user_id" && k !== "updated_at")
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-white/40">{k}</span>
                    <span>{String(v)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-white/40">Sem atributos.</p>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title={`Hábitos (${data.habits.length})`}>
          <AdminTable headers={["Título", "Atributo", "Ativo"]}>
            {data.habits.slice(0, 15).map((h) => (
              <tr key={h.id} className="text-white/75">
                <td className="px-2 py-1.5">{h.titulo}</td>
                <td className="px-2 py-1.5">{h.atributo}</td>
                <td className="px-2 py-1.5">{h.ativo ? "sim" : "não"}</td>
              </tr>
            ))}
          </AdminTable>
        </Panel>
        <Panel title={`Metas (${data.goals.length})`}>
          <AdminTable headers={["Título", "Cat.", "Ativa"]}>
            {data.goals.slice(0, 15).map((g) => (
              <tr key={g.id} className="text-white/75">
                <td className="px-2 py-1.5">{g.titulo}</td>
                <td className="px-2 py-1.5">{g.categoria}</td>
                <td className="px-2 py-1.5">{g.ativo ? "sim" : "não"}</td>
              </tr>
            ))}
          </AdminTable>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Desafios Charlie">
          <AdminTable headers={["Título", "Status", "XP"]}>
            {data.challenges.map((c) => (
              <tr key={c.id} className="text-white/75">
                <td className="px-2 py-1.5">{c.titulo}</td>
                <td className="px-2 py-1.5">{c.status}</td>
                <td className="px-2 py-1.5">{c.xp_recompensa}</td>
              </tr>
            ))}
          </AdminTable>
        </Panel>
        <Panel title="Notificações recentes">
          <AdminTable headers={["Tipo", "Título", "Lida"]}>
            {data.recentNotifications.map((n) => (
              <tr key={n.id} className="text-white/75">
                <td className="px-2 py-1.5">{n.tipo}</td>
                <td className="px-2 py-1.5">{n.titulo}</td>
                <td className="px-2 py-1.5">{n.lido_em ? "sim" : "não"}</td>
              </tr>
            ))}
          </AdminTable>
        </Panel>
      </div>
    </AdminShell>
  );
}
