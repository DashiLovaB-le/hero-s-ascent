import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type AuthTerminalMode = "signin" | "signup";

export type AuthTerminal2DProps = {
  locked: boolean;
  exiting?: boolean;
  onExitComplete?: () => void;
  onSignIn: (e: React.FormEvent<HTMLFormElement>) => void;
  onSignUp: (e: React.FormEvent<HTMLFormElement>) => void;
  onGoogle: () => void;
};

/**
 * Terminal de auth 2D — moldura industrial cyberpunk (referência visual).
 * Não depende de WebGL.
 */
export function AuthTerminal2D(props: AuthTerminal2DProps) {
  const [mode, setMode] = useState<AuthTerminalMode>("signin");

  useEffect(() => {
    if (!props.exiting) return;
    const id = window.setTimeout(() => props.onExitComplete?.(), 480);
    return () => window.clearTimeout(id);
  }, [props.exiting, props.onExitComplete]);

  return (
    <div
      className={cn(
        "auth-terminal w-full max-w-[420px] transition-all duration-500",
        props.exiting && "auth-terminal--exiting",
      )}
    >
      <div className="auth-terminal__bezel" aria-hidden={false}>
        <span className="auth-terminal__rivet auth-terminal__rivet--tl" aria-hidden />
        <span className="auth-terminal__rivet auth-terminal__rivet--tr" aria-hidden />
        <span className="auth-terminal__rivet auth-terminal__rivet--bl" aria-hidden />
        <span className="auth-terminal__rivet auth-terminal__rivet--br" aria-hidden />

        <div className="auth-terminal__leds" aria-hidden>
          <span className="auth-terminal__led auth-terminal__led--amber" />
          <span className="auth-terminal__led auth-terminal__led--green" />
        </div>

        <div className="auth-terminal__screen">
          <div className="auth-terminal__circuit" aria-hidden />
          <div className="auth-terminal__scan" aria-hidden />

          <div className="auth-terminal__body">
            <div className="auth-terminal__tabs" role="tablist" aria-label="Modo de acesso">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                disabled={props.locked}
                onClick={() => setMode("signin")}
                className={cn(
                  "auth-terminal__tab",
                  mode === "signin" && "auth-terminal__tab--active",
                )}
              >
                Entrar
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                disabled={props.locked}
                onClick={() => setMode("signup")}
                className={cn(
                  "auth-terminal__tab",
                  mode === "signup" && "auth-terminal__tab--active",
                )}
              >
                Criar conta
              </button>
            </div>

            {mode === "signin" ? (
              <form onSubmit={props.onSignIn} className="auth-terminal__form">
                <Field label="E-mail" id="auth2d-email-in">
                  <Input
                    id="auth2d-email-in"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    disabled={props.locked}
                    className="auth-terminal__input"
                  />
                </Field>
                <Field label="Senha" id="auth2d-pass-in">
                  <Input
                    id="auth2d-pass-in"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    disabled={props.locked}
                    className="auth-terminal__input"
                  />
                </Field>
                <Button type="submit" disabled={props.locked} className="auth-terminal__cta">
                  Entrar
                </Button>
              </form>
            ) : (
              <form onSubmit={props.onSignUp} className="auth-terminal__form">
                <Field label="Nome do herói" id="auth2d-nome">
                  <Input
                    id="auth2d-nome"
                    name="nome"
                    required
                    autoComplete="name"
                    disabled={props.locked}
                    className="auth-terminal__input"
                  />
                </Field>
                <Field label="E-mail" id="auth2d-email-up">
                  <Input
                    id="auth2d-email-up"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    disabled={props.locked}
                    className="auth-terminal__input"
                  />
                </Field>
                <Field label="Senha" id="auth2d-pass-up">
                  <Input
                    id="auth2d-pass-up"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={6}
                    disabled={props.locked}
                    className="auth-terminal__input"
                  />
                </Field>
                <Button type="submit" disabled={props.locked} className="auth-terminal__cta">
                  Aceitar o chamado
                </Button>
              </form>
            )}

            <div className="auth-terminal__divider" aria-hidden>
              <span className="auth-terminal__divider-line" />
              <span className="auth-terminal__divider-mark">
                <span className="auth-terminal__cog" />
                OU
                <span className="auth-terminal__cog" />
              </span>
              <span className="auth-terminal__divider-line" />
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={props.locked}
              onClick={props.onGoogle}
              className="auth-terminal__google"
            >
              Continuar com Google
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-terminal__field">
      <Label htmlFor={id} className="auth-terminal__label">
        {label}
      </Label>
      {children}
    </div>
  );
}
