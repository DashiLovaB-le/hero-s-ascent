import { useRef } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CheckItem, SlashLabel, TechMark } from "@/components/landing/LandingChrome";
import { LandingMobileGallery } from "@/components/landing/LandingMobileGallery";
import { LandingCharlieVersions } from "@/components/landing/LandingCharlieVersions";
import { LandingFlexaoSection } from "@/components/landing/LandingFlexaoSection";
import { useLandingGsap } from "@/components/landing/useLandingGsap";
import { isNativePlatform } from "@/lib/platform";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    // App nativo: landing não faz sentido — entra direto na jornada.
    if (isNativePlatform()) {
      throw redirect({ to: "/journey" });
    }
  },
  component: Landing,
});

const ATTRS = [
  "Disciplina",
  "Força",
  "Liderança",
  "Sabedoria",
  "Prosperidade",
  "Espírito",
  "Conhecimento",
  "Constância",
] as const;

const STEPS = [
  {
    n: "01",
    title: "Defina seus objetivos",
    body: "Escolha quem você deseja se tornar.",
  },
  {
    n: "02",
    title: "Complete suas missões diárias",
    body: "Cada hábito concluído gera progresso real.",
  },
  {
    n: "03",
    title: "Evolua seu personagem",
    body: "Seu crescimento deixa de ser invisível. Você vê sua evolução acontecendo.",
  },
  {
    n: "04",
    title: "Receba orientação inteligente",
    body: "O Charlie acompanha sua jornada, entende seus desafios e propõe novas missões para manter você em movimento.",
  },
] as const;

const FOR_WHO = [
  "cansaram de começar e parar",
  "querem desenvolver disciplina",
  "desejam evoluir física, mental e financeiramente",
  "querem assumir o controle da própria vida",
  "acreditam que seu potencial ainda está longe de ser alcançado",
] as const;

const DAILY = [
  "cumpre hábitos",
  "ganha XP",
  "fortalece atributos",
  "sobe de nível",
  "mantém sua sequência",
  "recebe orientação personalizada do Charlie, seu mentor com IA",
] as const;

function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  useLandingGsap(rootRef);

  return (
    <div ref={rootRef} className="min-h-screen overflow-x-hidden bg-[#1B1B1B] text-[#FFE7D0]">
      {/* ── HERO (~60dvh) ── */}
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
            <Link to="/sobre">
              <Button
                variant="ghost"
                size="sm"
                className="lp-btn lp-btn-sm h-8 rounded-none px-3 text-xs text-[#FFE7D0]/80 hover:bg-white/10 hover:text-[#FFE7D0]"
              >
                Sobre
              </Button>
            </Link>
            <Link to="/parceiros" className="hidden sm:block">
              <Button
                variant="ghost"
                size="sm"
                className="lp-btn lp-btn-sm h-8 rounded-none px-3 text-xs text-[#FFE7D0]/80 hover:bg-white/10 hover:text-[#FFE7D0]"
              >
                Parceiros
              </Button>
            </Link>
            <Link to="/auth">
              <Button
                variant="ghost"
                size="sm"
                className="lp-btn lp-btn-sm h-8 rounded-none px-3 text-xs text-[#FFE7D0]/80 hover:bg-white/10 hover:text-[#FFE7D0]"
              >
                Entrar
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
              A vida que você quer não depende de motivação.
            </h1>
            <p
              data-lp="hero-sub"
              className="mt-2.5 max-w-xl font-display text-base font-semibold tracking-[0.04em] text-hero sm:text-lg"
            >
              Ela depende de consistência.
            </p>
            <p
              data-lp="hero-copy"
              className="mt-3 max-w-lg text-xs leading-relaxed text-[#FFE7D0]/70 sm:text-sm"
            >
              O V-Project transforma seu desenvolvimento em uma jornada onde cada ação fortalece
              quem você está se tornando.
            </p>
            <div data-lp="hero-cta" className="mt-5">
              <Link to="/auth">
                <Button
                  size="sm"
                  className="lp-btn lp-cta-ghost h-9 rounded-none px-5 text-[10px] font-semibold tracking-[0.16em] shadow-hero sm:h-10 sm:px-7 sm:text-xs"
                >
                  COMEÇAR MINHA JORNADA
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── A DOR ── */}
      <section data-lp="section" className="relative bg-[#242424] px-5 py-10 sm:px-6 sm:py-14">
        <div className="pointer-events-none absolute inset-0 lp-grid-bg opacity-40" aria-hidden />
        <div data-lp="section-inner" className="relative mx-auto max-w-3xl">
          <SlashLabel>V-PROJECT // A DOR</SlashLabel>
          <TechMark className="mt-2" />
          <h2 className="mt-3.5 font-display text-xl font-bold tracking-[0.04em] text-[#FFE7D0] sm:text-2xl">
            Você já percebeu um padrão?
          </h2>
          <div className="mt-4 space-y-2 text-sm leading-snug text-[#FFE7D0]/75 sm:text-[15px]">
            <p>Você começa motivado.</p>
            <p>Treina por alguns dias.</p>
            <p>Lê alguns livros.</p>
            <p>Define metas.</p>
            <p className="pt-1 font-display text-base tracking-[0.04em] text-hero sm:text-lg">
              Depois… tudo volta ao normal.
            </p>
            <p className="pt-2">Não porque você seja incapaz.</p>
            <p>Mas porque ninguém nos ensina a manter consistência.</p>
            <div className="lp-card cp-brackets mt-4 p-4 sm:p-5">
              <p className="font-display text-sm uppercase tracking-[0.04em] text-[#FFE7D0] sm:text-base">
                Sem consistência, talento não importa.
              </p>
              <p className="mt-1.5 text-sm text-[#FFE7D0]/55">Inteligência não importa.</p>
              <p className="mt-1.5 text-sm font-medium text-hero">Motivação desaparece.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── A SOLUÇÃO ── */}
      <section data-lp="section" className="relative bg-[#1B1B1B] px-5 py-10 sm:px-6 sm:py-14">
        <div data-lp="section-inner" className="relative mx-auto max-w-5xl">
          <SlashLabel>V-PROJECT // SISTEMA</SlashLabel>
          <h2 className="mt-3.5 max-w-3xl font-display text-xl font-bold tracking-[0.04em] sm:text-2xl lg:text-3xl">
            O V-Project foi criado para resolver exatamente isso.
          </h2>
          <div className="mt-3 max-w-2xl space-y-1 text-sm text-[#FFE7D0]/65">
            <p>Não é uma agenda.</p>
            <p>Não é uma lista de tarefas.</p>
            <p>Não é apenas um aplicativo de hábitos.</p>
            <p className="pt-1.5 font-display text-sm tracking-[0.03em] text-[#FFE7D0] sm:text-base">
              É um sistema completo de evolução pessoal.
            </p>
          </div>

          <div className="lp-card cp-brackets mt-6 p-4 sm:p-5">
            <p className="font-display text-[11px] uppercase tracking-[0.24em] text-hero">
              Todos os dias você
            </p>
            <ul className="mt-3.5 grid gap-2 sm:grid-cols-2">
              {DAILY.map((item) => (
                <CheckItem key={item}>{item}</CheckItem>
              ))}
            </ul>
            <p className="mt-4 border-t border-hero/25 pt-3.5 text-xs text-[#FFE7D0]/65 sm:text-sm">
              Cada pequena vitória aproxima você da pessoa que deseja se tornar.
            </p>
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section
        id="como-funciona"
        data-lp="section"
        className="relative bg-[#323232] px-5 py-10 sm:px-6 sm:py-14"
      >
        <div data-lp="section-inner" className="mx-auto max-w-5xl">
          <SlashLabel>V-PROJECT // PROTOCOLO</SlashLabel>
          <h2 className="mt-3.5 font-display text-xl font-bold tracking-[0.04em] sm:text-2xl">
            Como funciona
          </h2>
          <div data-lp="steps" className="mt-5 grid gap-2.5 md:grid-cols-2">
            {STEPS.map((step) => (
              <div
                key={step.n}
                data-lp="step"
                className="lp-card lp-card-sm p-3.5 transition-[filter] duration-300 hover:brightness-110 sm:p-4"
              >
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono text-[10px] tracking-[0.18em] text-hero">
                    {step.n}
                  </span>
                </div>
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
              Um mentor disponível 24 horas por dia.
            </h2>
            <p className="mt-2.5 max-w-xl text-sm text-[#FFE7D0]/75">Não é apenas um chatbot.</p>
            <ul className="mt-4 max-w-xl space-y-1.5 text-xs text-white sm:text-sm">
              <li>Charlie conhece sua jornada.</li>
              <li>Analisa seu progresso.</li>
              <li>Percebe quando você está perdendo ritmo.</li>
              <li>Cria desafios personalizados.</li>
              <li>Ajuda você a recuperar consistência antes que desista.</li>
            </ul>
          </div>
        </div>
      </section>

      <LandingCharlieVersions />

      <LandingFlexaoSection />

      <LandingMobileGallery />

      {/* ── ATRIBUTOS ── */}
      <section data-lp="section" className="bg-[#1B1B1B] px-5 py-10 sm:px-6 sm:py-14">
        <div data-lp="section-inner" className="mx-auto max-w-5xl">
          <SlashLabel>V-PROJECT // ATRIBUTOS</SlashLabel>
          <h2 className="mt-3.5 font-display text-xl font-bold tracking-[0.04em] sm:text-2xl">
            O que você desenvolve
          </h2>
          <div data-lp="attrs" className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
            {ATTRS.map((a) => (
              <div
                key={a}
                data-lp="attr"
                className="lp-card lp-card-sm flex min-h-[3.25rem] items-end p-2.5 transition-[filter] duration-300 hover:brightness-110 sm:min-h-[3.75rem] sm:p-3"
              >
                <span className="font-display text-xs uppercase tracking-[0.06em] text-[#FFE7D0] sm:text-sm">
                  {a}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-2xl text-xs text-[#FFE7D0]/65 sm:text-sm">
            Porque uma vida extraordinária é construída através de pequenas vitórias diárias.
          </p>
        </div>
      </section>

      {/* ── PARA QUEM É ── */}
      <section data-lp="section" className="bg-[#242424] px-5 py-10 sm:px-6 sm:py-14">
        <div data-lp="section-inner" className="mx-auto max-w-3xl">
          <SlashLabel>V-PROJECT // PERFIL</SlashLabel>
          <h2 className="mt-3.5 font-display text-xl font-bold tracking-[0.04em] sm:text-2xl">
            Para homens que…
          </h2>
          <ul className="mt-4 space-y-2.5">
            {FOR_WHO.map((item) => (
              <CheckItem key={item}>{item}</CheckItem>
            ))}
          </ul>
        </div>
      </section>

      {/* ── DIFERENCIAL ── */}
      <section
        data-lp="section"
        className="bg-[#FFE7D0] px-5 py-10 text-[#1B1B1B] sm:px-6 sm:py-14"
      >
        <div data-lp="section-inner" className="mx-auto max-w-3xl">
          <p className="inline-flex items-center gap-2 font-sans text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FC6E20]">
            <span className="inline-block h-0.5 w-5 bg-[#FC6E20]" aria-hidden />
            V-PROJECT // DIFERENCIAL
          </p>
          <h2 className="mt-3.5 font-display text-xl font-bold tracking-[0.04em] sm:text-2xl">
            Enquanto outros aplicativos apenas lembram você de fazer tarefas…
          </h2>
          <p className="mt-2.5 font-display text-base tracking-[0.03em] text-[#FC6E20] sm:text-lg">
            O V-Project cria uma jornada.
          </p>
          <ul className="mt-4 space-y-1 text-sm leading-snug text-[#1B1B1B]/80">
            <li>Você evolui.</li>
            <li>Desbloqueia conquistas.</li>
            <li>Sobe de nível.</li>
            <li>Recebe novos desafios.</li>
            <li>É acompanhado por uma inteligência artificial.</li>
          </ul>
          <div className="lp-card cp-brackets mt-5 bg-[#1B1B1B] p-4 text-[#FFE7D0] sm:p-5">
            <p className="font-display text-sm uppercase tracking-[0.04em]">
              Seu progresso deixa de ser abstrato.
            </p>
            <p className="mt-1.5 text-sm font-medium text-hero">Ele passa a ser visível.</p>
          </div>
        </div>
      </section>

      {/* ── PREÇO ── */}
      <section data-lp="price" className="bg-[#1B1B1B] px-5 py-10 sm:px-6 sm:py-14">
        <div data-lp="section-inner" className="mx-auto max-w-3xl text-center">
          <SlashLabel bar={false} className="w-full justify-center">
            V-PROJECT // ACESSO
          </SlashLabel>
          <h2 className="mt-3.5 font-display text-xl font-bold tracking-[0.04em] sm:text-2xl">
            Sua evolução começa hoje.
          </h2>
          <p className="mt-2 text-sm text-[#FFE7D0]/65">
            Por menos do que o valor de uma pizza por mês.
          </p>
          <div className="cp-modal cp-brackets mx-auto mt-5 max-w-sm border border-transparent bg-[#1B1B1B] px-5 py-6 sm:px-7 sm:py-7">
            <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-[#FFE7D0]/50">
              Apenas
            </p>
            <p className="mt-2 font-display text-4xl font-bold tracking-[0.04em] text-hero sm:text-5xl">
              R$ <span data-lp="price-num">97</span>
              <span className="text-xl text-[#FFE7D0]/70 sm:text-2xl">/mês</span>
            </p>
            <p className="mt-2.5 text-xs text-[#FFE7D0]/55">
              Sem fidelidade. Cancele quando quiser.
            </p>
            <Link to="/auth" className="mt-5 inline-block">
              <Button
                size="sm"
                className="lp-btn lp-cta-ghost h-9 rounded-none px-5 text-[10px] font-semibold tracking-[0.16em] shadow-hero sm:h-10 sm:text-xs"
              >
                COMEÇAR MINHA JORNADA
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section data-lp="section" className="bg-[#242424] px-5 py-10 sm:px-6 sm:py-16">
        <div data-lp="section-inner" className="mx-auto max-w-3xl text-center">
          <SlashLabel bar={false} className="w-full justify-center">
            V-PROJECT // DECISÃO
          </SlashLabel>
          <h2 className="mt-3.5 font-display text-xl font-bold tracking-[0.04em] sm:text-3xl">
            Daqui a um ano…
          </h2>
          <p className="mx-auto mt-3.5 max-w-xl text-sm leading-snug text-[#FFE7D0]/70">
            Você pode continuar exatamente igual.
            <br />
            Ou pode olhar para trás e perceber que finalmente desenvolveu a disciplina que sempre
            buscou.
          </p>
          <p className="mt-3.5 font-display text-sm tracking-[0.04em] text-hero">
            A escolha começa hoje.
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
            to="/sobre"
            className="text-[#FFE7D0]/55 underline-offset-2 hover:text-hero hover:underline"
          >
            Sobre
          </Link>
          <Link
            to="/parceiros"
            className="text-[#FFE7D0]/55 underline-offset-2 hover:text-hero hover:underline"
          >
            Programa de parceiros
          </Link>
        </p>
      </footer>
    </div>
  );
}
