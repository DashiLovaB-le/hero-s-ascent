import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SlashLabel, CheckItem } from "@/components/landing/LandingChrome";

export const Route = createFileRoute("/obrigado")({
  ssr: false,
  component: ObrigadoPage,
});

const NEXT_STEPS = [
  "Crie sua conta (ou entre) com o mesmo e-mail da compra na Kiwify.",
  "Complete o onboarding e defina suas metas.",
  "Sua assinatura libera o acesso assim que o pagamento for confirmado.",
] as const;

function ObrigadoPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#1B1B1B] text-[#FFE7D0]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(252,110,32,0.18),_transparent_50%),radial-gradient(ellipse_at_bottom,_rgba(50,50,50,0.45),_transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.05] lp-grid-bg"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt=""
            className="h-8 w-8 object-cover shadow-hero"
            style={{
              clipPath:
                "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
            }}
          />
          <span className="font-display text-sm font-bold tracking-[0.1em]">V-PROJECT</span>
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col px-5 pb-16 pt-6 sm:px-6 sm:pt-10">
        <div className="lp-card cp-brackets p-5 sm:p-8">
          <SlashLabel>V-PROJECT // ACESSO</SlashLabel>
          <p className="mt-4 font-mono text-[10px] tracking-[0.24em] text-hero">PAGAMENTO RECEBIDO</p>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-[0.04em] text-[#FFE7D0] sm:text-3xl">
            Obrigado. Sua jornada começa agora.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#FFE7D0]/65 sm:text-base">
            A compra na Kiwify foi concluída. O próximo passo é entrar no V-Project com o{" "}
            <span className="text-[#FFE7D0]">mesmo e-mail</span> usado no checkout — assim
            vinculamos sua assinatura à conta.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/auth">
              <Button
                size="sm"
                className="lp-btn lp-cta-ghost h-10 w-full rounded-none px-6 text-[10px] font-semibold tracking-[0.16em] shadow-hero sm:w-auto sm:text-xs"
              >
                ENTRAR NO V-PROJECT
              </Button>
            </Link>
            <Link to="/">
              <Button
                variant="ghost"
                size="sm"
                className="lp-btn lp-btn-sm h-10 w-full rounded-none px-4 text-xs text-[#FFE7D0]/70 hover:bg-white/10 hover:text-[#FFE7D0] sm:w-auto"
              >
                Voltar à página inicial
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <SlashLabel>V-PROJECT // PRÓXIMOS PASSOS</SlashLabel>
          <h2 className="mt-3 font-display text-lg font-bold tracking-[0.04em] sm:text-xl">
            O que fazer agora
          </h2>
          <ul className="mt-4 space-y-2.5">
            {NEXT_STEPS.map((step) => (
              <CheckItem key={step}>{step}</CheckItem>
            ))}
          </ul>
        </div>

        <p className="mt-10 text-center text-xs leading-relaxed text-[#FFE7D0]/40 sm:text-left">
          Problemas com o acesso? Confira se o e-mail da compra é o mesmo do login. Se precisar de
          suporte, fale com a equipe V-Project.
        </p>
      </main>
    </div>
  );
}
