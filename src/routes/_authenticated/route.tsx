import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Target, Flame, LogOut, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CharlieNavButton } from "@/mentor/CharlieNavButton";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { NotificationBell } from "@/notifications/NotificationBell";
import { getJwtProjectRef, isJwtExpired } from "@/integrations/supabase/auth-session";
import { clearAllSupabaseAuthStorage, getSupabasePublicEnv } from "@/integrations/supabase/env";
import {
  WALLPAPER_CHANGE_EVENT,
  readStoredWallpaperId,
  resolveWallpaperBackground,
} from "@/lib/wallpaper-storage";

export const Route = createFileRoute("/_authenticated")({
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
      clearAllSupabaseAuthStorage();
      await supabase.auth.signOut({ scope: "local" });
      throw redirect({ to: "/auth" });
    }

    return { user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [wallpaperId, setWallpaperId] = useState(() => readStoredWallpaperId());

  useEffect(() => {
    function onChange(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") setWallpaperId(detail);
      else setWallpaperId(readStoredWallpaperId());
    }
    window.addEventListener(WALLPAPER_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(WALLPAPER_CHANGE_EVENT, onChange);
  }, []);

  const wallpaper = resolveWallpaperBackground(wallpaperId);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="relative isolate min-h-screen pb-28 md:pb-0">
      {/* z-0 no isolate = acima do body, abaixo do conteúdo */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        {wallpaper.src ? (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-[background-image] duration-500"
            style={{ backgroundImage: `url("${wallpaper.src}")` }}
          />
        ) : (
          <div className="absolute inset-0 bg-background" />
        )}
        <div
          className={`absolute inset-0 transition-colors duration-500 ${
            wallpaper.src ? "bg-background/50" : "bg-transparent"
          }`}
        />
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/journey" preload="intent" className="flex items-center gap-2">
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
          <div className="flex items-center gap-0.5">
            <NotificationBellBoundary>
              <NotificationBell />
            </NotificationBellBoundary>
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6">
        <Outlet />
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
      preload="intent"
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
      preload="intent"
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

/** Impede que falha no sino derrube o layout autenticado inteiro. */
class NotificationBellBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[NotificationBell]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
