import { useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CheckItem, SlashLabel, TechMark } from "@/components/landing/LandingChrome";
import { useLandingGsap } from "@/components/landing/useLandingGsap";

export const Route = createFileRoute("/sobre")({
  ssr: false,
  component: SobrePage,
  head: () => ({
    meta: [
      { title: "Sobre — V-Project" },
      {
        name: "description",
        content:
          "O que é o V-Project: jornada gamificada de disciplina com hábitos, XP e o mentor Charlie.",
      },
    ],
  }),
});

const LOOP = [
  { n: "01", title: "Missões do dia", body: "Hábitos que importam — não uma lista infinita." },
  { n: "02", title: "XP e atributos", body: "Cada check vira progresso que você vê." },
  { n: "03", title: "Streak e nível", body: "Consistência vira identidade, não vibe do momento." },
  { n: "04", title: "Charlie", body: "Mentor com IA que te puxa quando o ritmo cai." },
] as const;

const NAO_E = [
  "não é só um to-do com skin gamer",
  "não é curso pra assistir e esquecer",
  "não é motivação de stories",
] as const;

function SobrePage() {
  const rootRef = useRef<HTMLDivElement>(null);
  useLandingGsap(rootRef);

  return (
    <div ref={rootRef} className="min-h-screen overflow-x-hidden bg-[#1B1B1B] text-[#FFE7D0]">
      {/* ── HERO ── */}
      <section
        data-lp="hero"
        className="relative isolate flex min-h-[60dvh] flex-col overflow-hidden"
      >
        <img
          data-lp="hero-bg"
          src="/images/hero-section-lp.jpg"
          alt=""
          className="pointer-events-none absolute inset-0 -z-20 h-[120%] w-full object-cover object-center will-change-transform"
          fetchPriority="high"
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden
          style={{
            background: `
              linear-gradient(180deg, rgba(27,27,27,0.78) 0%, rgba(27,27,27,0.42) 40%, rgba(27,27,27,0.94) 100%),
              radial-gradient(ellipse 70% 50% at 50% 0%, rgba(252,110,32,0.22), transparent 55%)
            `,
          }}
        />

        <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt=""
              className="h-7 w-7 object-cover shadow-hero sm:h-8 sm:w-8"
              style={{
                clipPath:
                  "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
              }}
            />
            <span className="font-display text-sm font-bold tracking-[0.1em] text-[#FFE7D0] sm:text-base">
              V-PROJECT
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button
                variant="ghost"
                size="sm"
                className="lp-btn lp-btn-sm h-8 rounded-none px-3 text-xs text-[#FFE7D0]/80 hover:bg-white/10 hover:text-[#FFE7D0]"
              >
                Início
              </Button>
            </Link>
            <Link to="/auth">
              <Button
                size="sm"
                className="lp-btn lp-btn-sm lp-cta-ghost h-8 rounded-none px-3 text-xs shadow-hero"
              >
                Começar
              </Button>
            </Link>
          </div>
        </header>

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-end px-5 pb-12 pt-6 sm:px-6 sm:pb-14">
          <div>
            <p
              data-lp="hero-brand"
              className="font-display text-[11px] font-semibold uppercase tracking-[0.32em] text-hero sm:text-xs"
            >
              V-PROJECT
            </p>
            <h1
              data-lp="hero-title"
              className="mt-3 max-w-3xl font-display text-[1.35rem] font-bold leading-[1.1] tracking-[0.03em] text-[#FFE7D0] sm:text-3xl lg:text-4xl"
            >
              Sua vida, no modo jornada.
            </h1>
            <p
              data-lp="hero-sub"
              className="mt-2.5 max-w-xl font-display text-base font-semibold tracking-[0.04em] text-hero sm:text-lg"
            >
              Menos desculpa. Mais XP.
            </p>
            <p
              data-lp="hero-copy"
              className="mt-3 max-w-lg text-xs leading-relaxed text-[#FFE7D0]/70 sm:text-sm"
            >
              O V-Project transforma disciplina em jogo: hábitos, níveis e um mentor que não te
              deixa sumir no ghost.
            </p>
            <div data-lp="hero-cta" className="mt-5">
              <Link to="/auth">
                <Button
                  size="sm"
                  className="lp-btn lp-cta-ghost h-9 rounded-none px-5 text-[10px] font-semibold tracking-[0.16em] shadow-hero sm:h-10 sm:px-7 sm:text-xs"
                >
                  ENTRAR NA JORNADA
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── O QUE É ── */}
      <section data-lp="section" className="relative bg-[#242424] px-5 py-10 sm:px-6 sm:py-14">
        <div className="pointer-events-none absolute inset-0 lp-grid-bg opacity-40" aria-hidden />
        <div data-lp="section-inner" className="relative mx-auto max-w-3xl">
          <SlashLabel>V-PROJECT // SOBRE</SlashLabel>
          <TechMark className="mt-2" />
          <h2 className="mt-3.5 font-display text-xl font-bold tracking-[0.04em] text-[#FFE7D0] sm:text-2xl">
            Em uma frase
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[#FFE7D0]/75 sm:text-[15px]">
            É um app de evolução pessoal gamificado: você cumpre missões do dia, ganha XP, sobe de
            nível e conversa com o <span className="text-[#FFE7D0]">Charlie</span> — um mentor com
            IA que acompanha sua jornada de verdade.
          </p>
          <ul className="mt-5 space-y-2.5">
            {NAO_E.map((item) => (
              <CheckItem key={item}>{item}</CheckItem>
            ))}
          </ul>
          <p className="mt-5 font-display text-sm tracking-[0.04em] text-hero sm:text-base">
            É sistema. É presença. É o long game.
          </p>
        </div>
      </section>

      {/* ── LOOP ── */}
      <section data-lp="section" className="relative bg-[#1B1B1B] px-5 py-10 sm:px-6 sm:py-14">
        <div data-lp="section-inner" className="relative mx-auto max-w-5xl">
          <SlashLabel>V-PROJECT // LOOP</SlashLabel>
          <h2 className="mt-3.5 max-w-2xl font-display text-xl font-bold tracking-[0.04em] sm:text-2xl">
            Como rola no dia a dia
          </h2>
          <p className="mt-2 max-w-xl text-sm text-[#FFE7D0]/65">
            Sem tutorial eterno. Você abre, age, sobe.
          </p>
          <div data-lp="steps" className="mt-6 grid gap-2.5 md:grid-cols-2">
            {LOOP.map((step) => (
              <div
                key={step.n}
                data-lp="step"
                className="lp-card lp-card-sm p-3.5 transition-[filter] duration-300 hover:brightness-110 sm:p-4"
              >
                <span className="font-mono text-[10px] tracking-[0.18em] text-hero">{step.n}</span>
                <h3 className="mt-2 font-display text-sm uppercase tracking-[0.04em] text-[#FFE7D0] sm:text-base">
                  {step.title}
                </h3>
                <p className="mt-1 text-xs leading-snug text-[#FFE7D0]/55">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CHARLIE ── */}
      <section
        data-lp="charlie"
        className="relative px-5 py-10 sm:px-6 sm:py-14"
        style={{
          background: "linear-gradient(135deg, #3a1a0c 0%, #FC6E20 48%, #8a3a12 100%)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 lp-grid-bg opacity-30" aria-hidden />
        <div className="relative mx-auto max-w-5xl">
          <div
            data-lp="charlie-panel"
            className="cp-modal cp-brackets border border-transparent bg-[#1B1B1B]/92 p-4 will-change-transform sm:p-7"
          >
            <SlashLabel>V-PROJECT // CHARLIE</SlashLabel>
            <h2 className="mt-3.5 max-w-2xl font-display text-xl font-bold tracking-[0.04em] text-[#FFE7D0] sm:text-2xl lg:text-3xl">
              Seu mentor. Sem leave on read.
            </h2>
            <p className="mt-2.5 max-w-xl text-sm text-[#FFE7D0]/75">
              Charlie sabe onde você está na jornada. Quando o streak ameaça cair, ele aparece —
              desafio, pergunta, empurrão. Não é chat genérico.
            </p>
            <ul className="mt-4 max-w-xl space-y-1.5 text-xs text-white sm:text-sm">
              <li>Lê seu progresso e seus padrões.</li>
              <li>Propõe missões e hábitos que fazem sentido pra você.</li>
              <li>Mantém o ritmo quando a motivação some.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section data-lp="section" className="bg-[#242424] px-5 py-10 sm:px-6 sm:py-16">
        <div data-lp="section-inner" className="mx-auto max-w-3xl text-center">
          <SlashLabel bar={false} className="w-full justify-center">
            V-PROJECT // DECISÃO
          </SlashLabel>
          <h2 className="mt-3.5 font-display text-xl font-bold tracking-[0.04em] sm:text-3xl">
            Main character energy — de verdade.
          </h2>
          <p className="mx-auto mt-3.5 max-w-xl text-sm leading-snug text-[#FFE7D0]/70">
            Você pode continuar scrollando e prometendo “segunda-feira”.
            <br />
            Ou pode começar a jornada hoje.
          </p>
          <p className="mt-3.5 font-display text-sm tracking-[0.04em] text-hero">
            O sistema já está pronto. Falta você.
          </p>
          <Link to="/auth" className="mt-5 inline-block">
            <Button
              size="sm"
              className="lp-btn lp-cta-ghost h-9 rounded-none px-5 text-[10px] font-semibold tracking-[0.16em] shadow-hero sm:h-10 sm:px-8 sm:text-xs"
            >
              COMEÇAR MINHA JORNADA
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#1B1B1B] py-5 text-center text-[10px] tracking-[0.12em] text-[#FFE7D0]/40 sm:text-xs">
        <p>V-PROJECT — Você não precisa de mais motivação. Você precisa de um sistema.</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link
            to="/"
            className="text-[#FFE7D0]/55 underline-offset-2 hover:text-hero hover:underline"
          >
            Início
          </Link>
          <Link
            to="/parceiros"
            className="text-[#FFE7D0]/55 underline-offset-2 hover:text-hero hover:underline"
          >
            Parceiros
          </Link>
        </p>
      </footer>
    </div>
  );
}
