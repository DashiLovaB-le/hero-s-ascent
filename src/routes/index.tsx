import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Shield, Sparkles, Sword, TrendingUp, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

const PILARES = [
  {
    icon: TrendingUp,
    title: "Evolua com XP",
    desc: "Cada hábito completado gera XP e sobe seu nível — do Homem Comum até a Lenda.",
  },
  {
    icon: Shield,
    title: "8 Atributos",
    desc: "Força, Disciplina, Sabedoria, Espírito, Testosterona, Prosperidade, Conhecimento e Liderança.",
  },
  {
    icon: Flame,
    title: "Streak diário",
    desc: "Mantenha o fogo aceso. Dias consecutivos desbloqueiam conquistas raras.",
  },
  {
    icon: Compass,
    title: "7 Capítulos",
    desc: "Do Chamado à Lenda — a Jornada do Herói guia sua evolução.",
  },
  {
    icon: Sword,
    title: "Missões reais",
    desc: "Desafios diários e semanais adaptados às suas metas.",
  },
  {
    icon: Sparkles,
    title: "Charlie",
    desc: "Um mentor que aprende com você e aponta o próximo passo da jornada.",
  },
] as const;

function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ── Hero: uma composição, brand first, imagem full-bleed ── */}
      <section className="relative isolate flex min-h-[100dvh] flex-col">
        <img
          src="/images/hero-section-lp.jpg"
          alt=""
          className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-center"
          fetchPriority="high"
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden
          style={{
            background: `
              linear-gradient(180deg, rgba(27,27,27,0.72) 0%, rgba(27,27,27,0.45) 42%, rgba(27,27,27,0.92) 100%),
              radial-gradient(ellipse 70% 50% at 50% 0%, rgba(252,110,32,0.22), transparent 55%)
            `,
          }}
        />

        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt=""
              className="h-9 w-9 object-cover shadow-hero"
              style={{
                clipPath:
                  "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
              }}
            />
            <span className="font-display text-base font-bold tracking-[0.08em] text-foreground sm:text-lg">
              V-Project
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="rounded-none">
                Entrar
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="rounded-none shadow-hero">
                Começar
              </Button>
            </Link>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-end px-6 pb-16 pt-10 sm:pb-24">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.35em] text-hero sm:text-base">
              V-Project
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-[0.04em] text-foreground sm:text-6xl lg:text-7xl">
              Desperte o <span className="text-gradient-hero">herói</span>
              <br />
              dentro de você.
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground sm:text-lg">
              Transforme cada dia em um capítulo da sua evolução — hábitos, XP e atributos em uma
              jornada.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="rounded-none px-8 shadow-hero">
                  Começar minha jornada
                </Button>
              </Link>
              <a href="#pilares">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-none border-hero/40 bg-background/30 backdrop-blur-sm"
                >
                  Como funciona
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pilares: um propósito, um headline ── */}
      <section id="pilares" className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center animate-in fade-in duration-700">
          <h2 className="font-display text-3xl font-bold tracking-[0.04em] sm:text-4xl">
            A forja do herói
          </h2>
          <p className="mt-3 text-muted-foreground">
            Seis pilares. Um sistema. Sua evolução mensurável.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILARES.map((p, i) => (
            <div
              key={p.title}
              className="cp-panel border border-transparent bg-card/90 p-6 transition-[filter,transform] duration-300 hover:brightness-110"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div
                className="grid h-11 w-11 place-items-center bg-surface-elevated text-hero"
                style={{
                  clipPath:
                    "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                }}
              >
                <p.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold tracking-[0.03em]">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final: clip-path padrão (sem rounded) ── */}
      <section className="mx-auto max-w-3xl px-6 pb-20 sm:pb-28">
        <div className="cp-modal cp-brackets border border-transparent bg-hero-glow p-8 text-center shadow-elevated sm:p-12">
          <h2 className="font-display text-3xl font-bold tracking-[0.04em] sm:text-4xl">
            O chamado é hoje.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Sua jornada não começa amanhã. Começa no próximo hábito.
          </p>
          <Link to="/auth" className="mt-8 inline-block">
            <Button size="lg" className="rounded-none px-10 shadow-hero">
              Aceitar o chamado
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        V-Project — Forjado para homens que escolhem evoluir.
      </footer>
    </div>
  );
}
