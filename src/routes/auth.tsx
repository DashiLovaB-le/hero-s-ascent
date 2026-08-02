import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { clearAllSupabaseAuthStorage, getSupabasePublicEnv } from "@/integrations/supabase/env";
import { getJwtProjectRef } from "@/integrations/supabase/auth-session";
import { AuthDoorOverlay } from "@/components/auth/AuthDoorOverlay";
import { AuthWelcomeDialog } from "@/components/auth/AuthWelcomeDialog";
import { AuthTerminal2D } from "@/components/auth/AuthTerminal2D";
import { AuthTerminal3D } from "@/components/auth/AuthTerminal3D";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    /** Extra opcional: terminal Three.js. Padrão = 2D robusto. */
    hud: search.hud === "3d" ? ("3d" as const) : undefined,
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("E-mail inválido").max(255);
const passwordSchema = z.string().min(6, "Mínimo 6 caracteres").max(72);
const nameSchema = z.string().trim().min(2, "Nome muito curto").max(60);

const DOOR_FLAG = "v-auth-door";

function AuthPage() {
  const navigate = useNavigate();
  const { hud } = Route.useSearch();
  const prefer3d = hud === "3d";

  const [loading, setLoading] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [doorActive, setDoorActive] = useState(false);
  const [terminalExiting, setTerminalExiting] = useState(false);
  const [terminalGone, setTerminalGone] = useState(false);
  const entering = useRef(false);
  const pendingWelcome = useRef(false);

  function goJourney() {
    navigate({ to: "/journey", replace: true });
  }

  function openWelcome() {
    if (entering.current || welcomeOpen || doorActive) return;
    try {
      sessionStorage.removeItem(DOOR_FLAG);
    } catch {
      /* ignore */
    }
    setWelcomeOpen(true);
  }

  /** Sucesso de auth: some o terminal, depois abre o welcome → porta. */
  function beginSuccessExit() {
    if (entering.current || terminalExiting || doorActive) return;
    pendingWelcome.current = true;
    setTerminalExiting(true);
  }

  function handleTerminalExitComplete() {
    setTerminalGone(true);
    setTerminalExiting(false);
    if (pendingWelcome.current) {
      pendingWelcome.current = false;
      openWelcome();
    }
  }

  function playDoorThenEnter() {
    if (entering.current) return;
    entering.current = true;
    setWelcomeOpen(false);
    setDoorActive(true);
  }

  function handleWelcomeContinue() {
    setWelcomeOpen(false);
    playDoorThenEnter();
  }

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const { projectRef } = getSupabasePublicEnv();
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (token && projectRef) {
          const tokenRef = getJwtProjectRef(token);
          if (tokenRef && tokenRef !== projectRef) {
            clearAllSupabaseAuthStorage();
            await supabase.auth.signOut({ scope: "local" });
          }
        }
      } catch {
        /* ignore */
      }

      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user || entering.current) return;

      let wantsDoor = false;
      try {
        wantsDoor = sessionStorage.getItem(DOOR_FLAG) === "1";
      } catch {
        wantsDoor = false;
      }

      if (wantsDoor) {
        setTerminalGone(true);
        openWelcome();
      } else {
        goJourney();
      }
    }

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = emailSchema.safeParse(fd.get("email"));
    const password = passwordSchema.safeParse(fd.get("password"));
    if (!email.success) return toast.error(email.error.issues[0].message);
    if (!password.success) return toast.error(password.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.data,
      password: password.data,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    beginSuccessExit();
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = nameSchema.safeParse(fd.get("nome"));
    const email = emailSchema.safeParse(fd.get("email"));
    const password = passwordSchema.safeParse(fd.get("password"));
    if (!nome.success) return toast.error(nome.error.issues[0].message);
    if (!email.success) return toast.error(email.error.issues[0].message);
    if (!password.success) return toast.error(password.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.data,
      password: password.data,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nome: nome.data },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Sua jornada começou. Entre para continuar.");
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      sessionStorage.setItem(DOOR_FLAG, "1");
    } catch {
      /* ignore */
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });
    if (error) {
      setLoading(false);
      try {
        sessionStorage.removeItem(DOOR_FLAG);
      } catch {
        /* ignore */
      }
      return toast.error(error.message || "Erro ao entrar com Google.");
    }
  }

  const locked = loading || welcomeOpen || doorActive || terminalExiting;

  const terminalProps = {
    locked,
    exiting: terminalExiting,
    onExitComplete: handleTerminalExitComplete,
    onSignIn: handleSignIn,
    onSignUp: handleSignUp,
    onGoogle: handleGoogle,
  };

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10"
      style={{
        backgroundImage: "url('/porta-login.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-background/55" aria-hidden />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center">
        <Link to="/" className="mb-5 flex items-center justify-center gap-2">
          <img
            src="/logo.png"
            alt="V-Project"
            className="h-10 w-10 rounded-md object-cover shadow-hero"
          />
          <span className="font-display text-xl font-bold">V-Project</span>
        </Link>

        {!terminalGone ? (
          prefer3d ? (
            <TerminalErrorBoundary fallback={<AuthTerminal2D {...terminalProps} />}>
              <AuthTerminal3D {...terminalProps} />
            </TerminalErrorBoundary>
          ) : (
            <AuthTerminal2D {...terminalProps} />
          )
        ) : (
          <div className="h-24" aria-hidden />
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Ao continuar, você aceita percorrer sua Jornada do Herói.
        </p>
      </div>

      <AuthWelcomeDialog open={welcomeOpen} onContinue={handleWelcomeContinue} />
      <AuthDoorOverlay active={doorActive} onComplete={goJourney} />
    </div>
  );
}

class TerminalErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[AuthTerminal3D]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
