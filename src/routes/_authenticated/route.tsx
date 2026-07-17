import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sword, LayoutDashboard, Target, Flame, LogOut, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession é local/cacheado; evita round-trip de rede a cada navegação
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw redirect({ to: "/auth" });
    return { user: session.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/journey" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-hero text-hero-foreground shadow-hero">
              <Sword className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <span className="font-display text-base font-bold">V-Project</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <NavItem to="/journey" icon={<LayoutDashboard className="h-4 w-4" />} label="Jornada" />
            <NavItem to="/habits" icon={<Flame className="h-4 w-4" />} label="Hábitos" />
            <NavItem to="/goals" icon={<Target className="h-4 w-4" />} label="Metas" />
            <NavItem to="/profile" icon={<User className="h-4 w-4" />} label="Perfil" />
          </nav>
          <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/85 backdrop-blur-md md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          <BottomItem to="/journey" icon={<LayoutDashboard className="h-5 w-5" />} label="Jornada" />
          <BottomItem to="/habits" icon={<Flame className="h-5 w-5" />} label="Hábitos" />
          <BottomItem to="/goals" icon={<Target className="h-5 w-5" />} label="Metas" />
          <BottomItem to="/profile" icon={<User className="h-5 w-5" />} label="Perfil" />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      activeProps={{
        className:
          "group flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-accent/60 text-hero [&_.nav-icon]:nav-icon-glow",
      }}
    >
      <span className="nav-icon inline-flex transition-[filter,color] duration-200">{icon}</span>
      {label}
    </Link>
  );
}

function BottomItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1 py-3 text-xs text-muted-foreground transition-colors"
      activeProps={{
        className:
          "flex flex-col items-center gap-1 py-3 text-xs text-hero [&_.nav-icon]:nav-icon-glow",
      }}
    >
      <span className="nav-icon inline-flex transition-[filter,color] duration-200">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
