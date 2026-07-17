import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Shield, Sparkles, Sword, TrendingUp, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="V-Project"
            className="h-9 w-9 rounded-md object-cover shadow-hero"
          />
          <span className="font-display text-lg font-bold tracking-tight">V-Project</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost" size="sm">Entrar</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm">Começar Jornada</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-24 text-center animate-in fade-in duration-700">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-hero">
          <Sparkles className="h-3.5 w-3.5" />
          Jornada do Herói
        </div>
        <h1 className="mt-8 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
          Desperte o <span className="text-gradient-hero">herói</span>
          <br />
          dentro de você.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Transforme cada dia em um capítulo da sua evolução. Ganhe XP, forje atributos e
          construa o homem que você quer se tornar — um hábito por vez.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="shadow-hero">Começar minha jornada</Button>
          </Link>
          <a href="#pilares">
            <Button size="lg" variant="outline">Como funciona</Button>
          </a>
        </div>
      </section>

      {/* Pilares */}
      <section id="pilares" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: TrendingUp, title: "Evolua com XP", desc: "Cada hábito completado gera XP e sobe seu nível — do Homem Comum até a Lenda." },
            { icon: Shield, title: "8 Atributos", desc: "Força, Disciplina, Sabedoria, Espírito, Testosterona, Prosperidade, Conhecimento e Liderança." },
            { icon: Flame, title: "Streak diário", desc: "Mantenha o fogo aceso. Dias consecutivos desbloqueiam conquistas raras." },
            { icon: Compass, title: "7 Capítulos", desc: "Do Chamado à Lenda — a Jornada do Herói guia sua evolução." },
            { icon: Sword, title: "Missões reais", desc: "Desafios diários e semanais adaptados às suas metas." },
            { icon: Sparkles, title: "Mentor com IA", desc: "Um conselheiro que aprende com você e sugere o próximo passo." },
          ].map((p) => (
            <div key={p.title} className="cp-panel border border-transparent bg-card p-6 transition-colors hover:brightness-110">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-surface-elevated text-hero">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <div className="rounded-2xl border border-hero/30 bg-hero-glow p-10 shadow-elevated">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            O chamado é hoje.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Sua jornada não começa amanhã. Começa no próximo hábito.
          </p>
          <Link to="/auth" className="mt-6 inline-block">
            <Button size="lg" className="shadow-hero">Aceitar o chamado</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        V-Project — Forjado para homens que escolhem evoluir.
      </footer>
    </div>
  );
}
