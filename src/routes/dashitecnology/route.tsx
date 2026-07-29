import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { adminAmIAdmin, adminClaimBootstrap } from "@/admin/functions";
import { clearAllSupabaseAuthStorage, getSupabasePublicEnv } from "@/integrations/supabase/env";
import { getJwtProjectRef, isJwtExpired } from "@/integrations/supabase/auth-session";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AdminShell } from "@/admin/ui";

export const Route = createFileRoute("/dashitecnology")({
  ssr: false,
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    let user = session?.user ?? null;
    let token = session?.access_token;

    if (token) {
      const expectedRef = getSupabasePublicEnv().projectRef;
      const tokenRef = getJwtProjectRef(token);
      if (expectedRef && tokenRef && tokenRef !== expectedRef) {
        clearAllSupabaseAuthStorage();
        await supabase.auth.signOut({ scope: "local" });
        token = undefined;
        user = null;
      } else if (isJwtExpired(token, 60)) {
        const refreshed = await supabase.auth.refreshSession();
        user = refreshed.data.session?.user ?? null;
        token = refreshed.data.session?.access_token;
        if (!token) {
          clearAllSupabaseAuthStorage();
          await supabase.auth.signOut({ scope: "local" });
          user = null;
        }
      }
    }

    if (!user || !token) {
      throw redirect({ to: "/auth" });
    }

    let gate: { admin: boolean; adminsTotal: number; userId: string };
    try {
      gate = await adminAmIAdmin();
    } catch {
      throw redirect({ to: "/auth" });
    }

    return { user, gate };
  },
  component: AdminGateLayout,
});

function AdminGateLayout() {
  const { gate, user } = Route.useRouteContext();
  const qc = useQueryClient();
  const claimFn = useServerFn(adminClaimBootstrap);

  const claim = useMutation({
    mutationFn: () => claimFn(),
    onSuccess: async () => {
      toast.success("Role dashi concedida. Recarregando…");
      await qc.invalidateQueries();
      window.location.reload();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!gate.admin) {
    return (
      <AdminShell title="Acesso restrito" subtitle="Somente role dashi.">
        <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm text-white/70">
            Conta: <span className="text-white">{user.email ?? gate.userId}</span>
          </p>
          <p className="text-sm text-white/50">
            Contas dashi: <strong className="text-white">{gate.adminsTotal}</strong>
          </p>
          {gate.adminsTotal === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-white/60">
                Nenhuma role dashi ainda. Se o seu email estiver em{" "}
                <code className="text-[#FC6E20]">DASHI_BOOTSTRAP_EMAIL</code>, reclame o acesso:
              </p>
              <Button
                onClick={() => claim.mutate()}
                disabled={claim.isPending}
                className="bg-[#FC6E20] text-black hover:bg-[#FC6E20]/90"
              >
                {claim.isPending ? "Reivindicando…" : "Reivindicar dashi (bootstrap)"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-white/50">
              Peça a alguém com role dashi para conceder em Heróis, ou rode no SQL:
              <br />
              <code className="mt-2 block text-xs text-[#FC6E20]">
                insert into user_roles (user_id, role) values (&apos;{gate.userId}&apos;, &apos;dashi&apos;);
              </code>
            </p>
          )}
        </div>
      </AdminShell>
    );
  }

  return <Outlet />;
}
