import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminAdjustXp,
  adminClearUserHistory,
  adminRecomputeUserMl,
  adminSetUserRole,
  adminUserDetail,
} from "@/admin/functions";
import {
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

export const Route = createFileRoute("/dashitecnology/users/$userId")({
  ssr: false,
  beforeLoad: ({ params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.userId)) {
      throw new Error("ID de herói inválido.");
    }
  },
  errorComponent: ({ error }) => (
    <AdminShell title="Erro">
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        {error instanceof Error ? error.message : String(error)}
      </div>
    </AdminShell>
  ),
  component: UserDetailPage,
});

function UserDetailPage() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();
  const [xpDelta, setXpDelta] = useState("100");
  const [clearConfirm, setClearConfirm] = useState("");
  const [clearOpen, setClearOpen] = useState(false);

  const detailFn = useServerFn(adminUserDetail);
  const roleFn = useServerFn(adminSetUserRole);
  const xpFn = useServerFn(adminAdjustXp);
  const mlFn = useServerFn(adminRecomputeUserMl);
  const clearFn = useServerFn(adminClearUserHistory);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: () =>
      runQueryFn(() => detailFn({ data: { userId } }), "Falha ao carregar herói."),
    staleTime: 15_000,
  });

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

  const clearHistory = useMutation({
    mutationFn: () => clearFn({ data: { userId, confirm: "LIMPAR" as const } }),
    onSuccess: (r) => {
      toast.success(`Histórico limpo · ${r.totalDeleted} registros removidos`);
      setClearOpen(false);
      setClearConfirm("");
      void invalidate();
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <AdminShell title="Herói" subtitle={userId}>
        <div className="animate-pulse space-y-3">
          <div className="h-24 rounded-xl bg-white/5" />
          <div className="h-48 rounded-xl bg-white/5" />
        </div>
      </AdminShell>
    );
  }

  if (isError || !data) {
    return (
      <AdminShell title="Herói" subtitle={userId}>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error instanceof Error ? error.message : "Falha ao carregar herói."}
        </div>
        <Button className="mt-4" variant="outline" onClick={() => void refetch()}>
          Tentar de novo
        </Button>
      </AdminShell>
    );
  }

  const p = data.profile;
  if (!p) {
    return (
      <AdminShell title="Herói" subtitle={userId}>
        <p className="text-sm text-white/50">Perfil não encontrado. {data.profileError}</p>
        <Link to="/dashitecnology/users" className="mt-4 inline-block text-sm text-[#FC6E20]">
          ← Voltar à lista
        </Link>
      </AdminShell>
    );
  }

  const isAdminUser = data.roles.includes("dashi");
  const canConfirmClear = clearConfirm.trim().toUpperCase() === "LIMPAR";

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
            {isAdminUser ? (
              <Button
                variant="outline"
                onClick={() => revokeAdmin.mutate()}
                disabled={revokeAdmin.isPending}
              >
                Remover dashi
              </Button>
            ) : (
              <Button onClick={() => grantAdmin.mutate()} disabled={grantAdmin.isPending}>
                Tornar dashi
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => recompute.mutate()}
              disabled={recompute.isPending}
            >
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

      <Panel className="mt-4 border-destructive/30" title="Zona de risco">
        <p className="mb-3 text-sm text-white/55">
          Apaga o histórico deste herói: chat do Charlie, memórias, desafios, conclusões de hábitos,
          sessões de exercício validado (flexões e métricas), check-ins, missões, notificações,
          scores ML e uso de IA. Zera XP, streak, capítulo e atributos (volta tudo para 1). Mantém
          conta, nome, hábitos/metas cadastrados e roles.
        </p>
        <AlertDialog
          open={clearOpen}
          onOpenChange={(open) => {
            setClearOpen(open);
            if (!open) setClearConfirm("");
          }}
        >
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={clearHistory.isPending}>
              Limpar histórico completo
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-destructive/40 bg-card">
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar histórico de {p.nome || "herói"}?</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Ação irreversível. Digite <strong className="text-foreground">LIMPAR</strong> para
                confirmar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={clearConfirm}
              onChange={(e) => setClearConfirm(e.target.value)}
              placeholder="LIMPAR"
              className="border-white/10 bg-black/30 font-mono uppercase tracking-wider"
              autoComplete="off"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={!canConfirmClear || clearHistory.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  if (!canConfirmClear) return;
                  clearHistory.mutate();
                }}
              >
                {clearHistory.isPending ? "Limpando…" : "Confirmar limpeza"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Panel>

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
