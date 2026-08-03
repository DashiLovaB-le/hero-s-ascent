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
import { MENTOR_FOCUS_EVENT, readMentorFocusMode } from "@/mentor/focus-mode";
import { isOnboardingAllowedPath } from "@/lib/chapters";
import { ProductTour } from "@/components/onboarding/ProductTour";
import { shouldOpenProductTour } from "@/lib/product-tour.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
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

    let onboardingDone = false;
    let tourVisto = true;

    const profileRes = await supabase
      .from("profiles")
      .select("onboarding_completo, tour_visto")
      .eq("id", user.id)
      .maybeSingle();

    if (profileRes.error && /tour_visto|column|schema cache/i.test(profileRes.error.message)) {
      const fallback = await supabase
        .from("profiles")
        .select("onboarding_completo")
        .eq("id", user.id)
        .maybeSingle();
      onboardingDone = fallback.data?.onboarding_completo === true;
      // Sem coluna: não força tour em usuários antigos (só via session pós-setup).
      tourVisto = true;
    } else if (profileRes.error) {
      console.error("[auth] profiles:", profileRes.error.message);
      onboardingDone = false;
      tourVisto = true;
    } else {
      onboardingDone = profileRes.data?.onboarding_completo === true;
      tourVisto = profileRes.data?.tour_visto === true;
    }

    const path = location.pathname;
    const onOnboarding = path === "/onboarding" || path.endsWith("/onboarding");

    if (!onboardingDone && !isOnboardingAllowedPath(path)) {
      throw redirect({ to: "/onboarding" });
    }
    if (onboardingDone && onOnboarding) {
      throw redirect({ to: "/journey" });
    }

    return { user, onboardingCompleto: onboardingDone, tourVisto };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, onboardingCompleto, tourVisto } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [wallpaperId, setWallpaperId] = useState(() => readStoredWallpaperId());
  const [mentorFocus, setMentorFocus] = useState(() => readMentorFocusMode());
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    setTourOpen(
      shouldOpenProductTour({
        onboardingCompleto,
        tourVisto,
        userId: user.id,
      }),
    );
  }, [onboardingCompleto, tourVisto, user.id]);

  useEffect(() => {
    function onFocus(e: Event) {
      const detail = (e as CustomEvent<boolean>).detail;
      setMentorFocus(typeof detail === "boolean" ? detail : readMentorFocusMode());
    }
    window.addEventListener(MENTOR_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(MENTOR_FOCUS_EVENT, onFocus);
  }, []);

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
    <div
      className={`relative isolate min-h-screen ${mentorFocus ? "pb-0" : "pb-28 md:pb-0"}`}
    >
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

      {!mentorFocus && (
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
      )}

      <main
        className={`app-main relative z-10 mx-auto max-w-6xl ${
          mentorFocus ? "px-0 py-0" : "px-4 py-6"
        }`}
      >
        <OutletErrorBoundary>
          <Outlet />
        </OutletErrorBoundary>
      </main>

      {onboardingCompleto && (
        <ProductTour
          open={tourOpen}
          userId={user.id}
          onComplete={() => setTourOpen(false)}
        />
      )}

      {!mentorFocus && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 overflow-visible border-t border-border bg-background/90 backdrop-blur-md md:hidden">
          <div className="relative mx-auto grid h-[64px] max-w-[370px] grid-cols-5 items-end">
            <BottomItem to="/journey" icon={<LayoutDashboard className="size-6" strokeWidth={2} />} label="Jornada" />
            <BottomItem to="/habits" icon={<Flame className="size-6" strokeWidth={2} />} label="Hábitos" />
            <CharlieNavButton />
            <BottomItem to="/goals" icon={<Target className="size-6" strokeWidth={2} />} label="Metas" />
            <BottomItem to="/profile" icon={<User className="size-6" strokeWidth={2} />} label="Perfil" />
          </div>
        </nav>
      )}
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

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const safe =
      error instanceof Error ? error : new Error(String(error ?? "NotificationBell failed"));
    console.error("[NotificationBell]", safe, info.componentStack);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/** Erros no Outlet não derrubam header/nav. */
class OutletErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : String(error ?? "Algo deu errado ao carregar esta tela.");
    return { hasError: true, message: message || "Algo deu errado ao carregar esta tela." };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const safe =
      error instanceof Error ? error : new Error(String(error ?? "Outlet render failed"));
    console.error("[AuthedOutlet]", safe, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          <p>{this.state.message}</p>
          <button
            type="button"
            className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground"
            onClick={() => this.setState({ hasError: false, message: "" })}
          >
            Tentar de novo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
