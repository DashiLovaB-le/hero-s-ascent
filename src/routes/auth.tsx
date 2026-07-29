import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { clearAllSupabaseAuthStorage, getSupabasePublicEnv } from "@/integrations/supabase/env";
import { getJwtProjectRef } from "@/integrations/supabase/auth-session";
import { AuthDoorOverlay } from "@/components/auth/AuthDoorOverlay";
import { AuthWelcomeDialog } from "@/components/auth/AuthWelcomeDialog";
import { AuthTerminal3D } from "@/components/auth/AuthTerminal3D";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

const emailSchema = z.string().trim().email("E-mail inválido").max(255);
const passwordSchema = z.string().min(6, "Mínimo 6 caracteres").max(72);
const nameSchema = z.string().trim().min(2, "Nome muito curto").max(60);

const DOOR_FLAG = "v-auth-door";

function AuthPage() {
  const navigate = useNavigate();
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

  /** Sucesso de auth: some o terminal 3D, depois abre o welcome → porta. */
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
        <Link to="/" className="mb-4 flex items-center justify-center gap-2">
          <img
            src="/logo.png"
            alt="V-Project"
            className="h-10 w-10 rounded-md object-cover shadow-hero"
          />
          <span className="font-display text-xl font-bold">V-Project</span>
        </Link>

        {!terminalGone ? (
          <TerminalErrorBoundary
            fallback={
              <AuthFallback2D
                locked={locked}
                onSignIn={handleSignIn}
                onSignUp={handleSignUp}
                onGoogle={handleGoogle}
              />
            }
          >
            <AuthTerminal3D
              locked={locked}
              exiting={terminalExiting}
              onExitComplete={handleTerminalExitComplete}
              onSignIn={handleSignIn}
              onSignUp={handleSignUp}
              onGoogle={handleGoogle}
            />
          </TerminalErrorBoundary>
        ) : (
          <div className="h-24" aria-hidden />
        )}

        <p className="mt-2 text-center text-xs text-muted-foreground">
          Ao continuar, você aceita percorrer sua Jornada do Herói.
        </p>
      </div>

      <AuthWelcomeDialog open={welcomeOpen} onContinue={handleWelcomeContinue} />
      <AuthDoorOverlay active={doorActive} onComplete={goJourney} />
    </div>
  );
}

/** Fallback 2D se o canvas 3D falhar. */
function AuthFallback2D({
  locked,
  onSignIn,
  onSignUp,
  onGoogle,
}: {
  locked: boolean;
  onSignIn: (e: React.FormEvent<HTMLFormElement>) => void;
  onSignUp: (e: React.FormEvent<HTMLFormElement>) => void;
  onGoogle: () => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  return (
    <div className="w-full max-w-md border border-[#FC6E20]/40 bg-card/90 p-6 shadow-elevated backdrop-blur-sm">
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={mode === "signin" ? "default" : "outline"}
          onClick={() => setMode("signin")}
          disabled={locked}
        >
          Entrar
        </Button>
        <Button
          type="button"
          variant={mode === "signup" ? "default" : "outline"}
          onClick={() => setMode("signup")}
          disabled={locked}
        >
          Criar conta
        </Button>
      </div>
      {mode === "signin" ? (
        <form onSubmit={onSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fb-email-in">E-mail</Label>
            <Input id="fb-email-in" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-pass-in">Senha</Label>
            <Input
              id="fb-pass-in"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={locked}>
            Entrar
          </Button>
        </form>
      ) : (
        <form onSubmit={onSignUp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fb-nome">Nome do herói</Label>
            <Input id="fb-nome" name="nome" required autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-email-up">E-mail</Label>
            <Input id="fb-email-up" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-pass-up">Senha</Label>
            <Input
              id="fb-pass-up"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={locked}>
            Aceitar o chamado
          </Button>
        </form>
      )}
      <div className="my-4 text-center text-xs uppercase tracking-widest text-muted-foreground">
        ou
      </div>
      <Button type="button" variant="outline" className="w-full" onClick={onGoogle} disabled={locked}>
        Continuar com Google
      </Button>
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
