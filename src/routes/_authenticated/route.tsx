import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Target, Flame, LogOut, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CharlieNavButton } from "@/mentor/CharlieNavButton";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
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
    <div className="min-h-screen pb-28 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/journey" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="V-Project"
              className="h-8 w-8 rounded-md object-cover shadow-hero"
            />
            <span className="font-display text-base font-bold">V-Project</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <NavItem to="/journey" icon={<LayoutDashboard className="h-4 w-4" />} label="Jornada" />
            <NavItem to="/habits" icon={<Flame className="h-4 w-4" />} label="Hábitos" />
            <NavItem
              to="/mentor"
              icon={
                <img
                  src="/charlie.png"
                  alt=""
                  className="h-5 w-5 rounded-full object-cover object-top ring-1 ring-hero/50"
                />
              }
              label="Charlie"
            />
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

      <nav className="fixed bottom-0 left-0 right-0 z-40 overflow-visible border-t border-border bg-background/90 backdrop-blur-md md:hidden">
        <div className="relative mx-auto grid h-[64px] max-w-[370px] grid-cols-5 items-end">
          <BottomItem to="/journey" icon={<LayoutDashboard className="size-6" strokeWidth={2} />} label="Jornada" />
          <BottomItem to="/habits" icon={<Flame className="size-6" strokeWidth={2} />} label="Hábitos" />
          <CharlieNavButton />
          <BottomItem to="/goals" icon={<Target className="size-6" strokeWidth={2} />} label="Metas" />
          <BottomItem to="/profile" icon={<User className="size-6" strokeWidth={2} />} label="Perfil" />
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
      className="flex h-full flex-col items-center justify-center gap-1 text-[12px] leading-none text-muted-foreground transition-colors"
      activeProps={{
        className:
          "flex h-full flex-col items-center justify-center gap-1 text-[12px] leading-none text-hero [&_.nav-icon]:nav-icon-glow [&_.nav-active-bar]:bg-hero",
      }}
    >
      <span className="nav-active-bar mb-0.5 h-0.5 w-4 rounded-full bg-transparent" aria-hidden />
      <span className="nav-icon inline-flex size-6 items-center justify-center transition-[filter,color] duration-200">
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}
