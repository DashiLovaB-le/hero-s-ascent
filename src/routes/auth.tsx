import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { AuthDoorOverlay } from "@/components/auth/AuthDoorOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [doorActive, setDoorActive] = useState(false);
  const entering = useRef(false);

  function goJourney() {
    navigate({ to: "/journey", replace: true });
  }

  function playDoorThenEnter() {
    if (entering.current) return;
    entering.current = true;
    try {
      sessionStorage.removeItem(DOOR_FLAG);
    } catch {
      /* ignore */
    }
    setDoorActive(true);
  }

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user || entering.current) return;

      let wantsDoor = false;
      try {
        wantsDoor = sessionStorage.getItem(DOOR_FLAG) === "1";
      } catch {
        wantsDoor = false;
      }

      if (wantsDoor) {
        playDoorThenEnter();
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
    toast.success("Bem-vindo de volta, herói.");
    playDoorThenEnter();
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
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) {
      setLoading(false);
      try {
        sessionStorage.removeItem(DOOR_FLAG);
      } catch {
        /* ignore */
      }
      return toast.error("Erro ao entrar com Google.");
    }
    if (result.redirected) return;
    toast.success("Bem-vindo de volta, herói.");
    playDoorThenEnter();
  }

  return (
    <div
      className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12"
      style={{
        backgroundImage: "url('/porta-login.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-background/55" aria-hidden />
      <div className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <img
            src="/logo.png"
            alt="V-Project"
            className="h-10 w-10 rounded-md object-cover shadow-hero"
          />
          <span className="font-display text-xl font-bold">V-Project</span>
        </Link>

        <div className="cp-modal cp-brackets border border-transparent bg-card/90 p-6 shadow-elevated backdrop-blur-sm">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-in">E-mail</Label>
                  <Input id="email-in" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pass-in">Senha</Label>
                  <Input id="pass-in" name="password" type="password" required autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading || doorActive}>
                  Entrar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do herói</Label>
                  <Input id="nome" name="nome" required autoComplete="name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-up">E-mail</Label>
                  <Input id="email-up" name="email" type="email" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pass-up">Senha</Label>
                  <Input
                    id="pass-up"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || doorActive}>
                  Aceitar o chamado
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={loading || doorActive}
          >
            Continuar com Google
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ao continuar, você aceita percorrer sua Jornada do Herói.
        </p>
      </div>

      <AuthDoorOverlay active={doorActive} onComplete={goJourney} />
    </div>
  );
}
