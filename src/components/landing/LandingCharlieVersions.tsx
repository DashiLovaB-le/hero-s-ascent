import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SlashLabel } from "@/components/landing/LandingChrome";
import { cn } from "@/lib/utils";

const CHARLIE_VERSIONS = [
  {
    slug: "classico",
    name: "Charlie Clássico",
    tagline: "Equilibrado. Faz perguntas. Incentiva sem pressionar.",
    body: "Ideal para a maioria. Acompanha sua jornada com firmeza e escuta — sem pressa, sem frouxidão.",
    image: "/charlie-versions/charlie-classico.png",
  },
  {
    slug: "militar",
    name: "Charlie Militar",
    tagline: "Extremamente disciplinador. Pouca conversa, muita ação.",
    body: "Ordens claras. Zero enrolação. Ele corta o ruído e aponta o próximo passo — e espera execução.",
    image: "/charlie-versions/charlie-militar.png",
  },
  {
    slug: "estoico",
    name: "Charlie Estoico",
    tagline: "Autocontrole, virtude e responsabilidade.",
    body: "Menos emoção performática, mais caráter. Foca no que depende de você e na ação correta.",
    image: "/charlie-versions/charlie-estoico.png",
  },
  {
    slug: "empresarial",
    name: "Charlie Empresarial",
    tagline: "Produtividade, riqueza e liderança.",
    body: "Quase um CEO particular: metas, prioridade, prazo e cobrança alta — com respeito intacto.",
    image: "/charlie-versions/charlie-empresarial.png",
  },
  {
    slug: "cristao",
    name: "Charlie Cristão",
    tagline: "Propósito, humildade e fé.",
    body: "A mesma inteligência prática, ancorada em virtudes cristãs: graça, verdade e domínio próprio.",
    image: "/charlie-versions/charlie-cristao.png",
  },
  {
    slug: "fitness",
    name: "Charlie Fitness",
    tagline: "Treino, alimentação, sono e recuperação.",
    body: "Coach direto para o corpo: consistência, progressive overload de hábitos e um ajuste por vez.",
    image: "/charlie-versions/charlie-fitness.png",
  },
  {
    slug: "financeiro",
    name: "Charlie Financeiro",
    tagline: "Patrimônio, investimentos e organização.",
    body: "Disciplina de caixa e clareza de números. Sócio sóbrio — sem hype, com execução.",
    image: "/charlie-versions/charlie-financeiro.png",
  },
] as const;

export function LandingCharlieVersions() {
  const [index, setIndex] = useState(0);
  const total = CHARLIE_VERSIONS.length;
  const version = CHARLIE_VERSIONS[index]!;

  function go(delta: number) {
    setIndex((i) => (i + delta + total) % total);
  }

  return (
    <section data-lp="section" className="relative bg-[#242424] px-5 py-10 sm:px-6 sm:py-14">
      <div className="pointer-events-none absolute inset-0 lp-grid-bg opacity-25" aria-hidden />
      <div data-lp="section-inner" className="relative mx-auto max-w-5xl">
        <SlashLabel>V-PROJECT // VERSÕES DO CHARLIE</SlashLabel>
        <h2 className="mt-3.5 max-w-2xl font-display text-xl font-bold tracking-[0.04em] text-[#FFE7D0] sm:text-2xl">
          Escolha o mentor que combina com você.
        </h2>
        <p className="mt-2 max-w-xl text-sm text-[#FFE7D0]/60">
          O Charlie adapta o tom. A disciplina continua a mesma.
        </p>

        <div className="relative mt-8">
          <div
            key={version.slug}
            className="lp-card cp-brackets grid items-center gap-6 p-4 sm:grid-cols-2 sm:gap-8 sm:p-6 animate-in fade-in-0 duration-200"
          >
            <div className="order-2 min-w-0 sm:order-1">
              <p className="font-mono text-[10px] tracking-[0.22em] text-hero">
                {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
              </p>
              <h3 className="mt-2 font-display text-lg font-bold tracking-[0.04em] text-[#FFE7D0] sm:text-xl">
                {version.name}
              </h3>
              <p className="mt-2 font-display text-sm tracking-[0.02em] text-hero sm:text-base">
                {version.tagline}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#FFE7D0]/65">{version.body}</p>
            </div>

            <div className="order-1 flex justify-center sm:order-2 sm:justify-end">
              <div className="relative w-full max-w-[220px] overflow-hidden border border-hero/30 bg-[#0d0d0d] sm:max-w-[260px]">
                <img
                  src={version.image}
                  alt={version.name}
                  width={520}
                  height={650}
                  className="aspect-[4/5] w-full object-cover object-top"
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1B1B1B]/50 via-transparent to-transparent"
                  aria-hidden
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Versão anterior"
              className="inline-flex h-10 w-10 items-center justify-center border border-hero/40 bg-[#1B1B1B] text-hero transition-colors hover:bg-hero hover:text-[#1B1B1B]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex flex-wrap items-center justify-center gap-1.5" role="tablist" aria-label="Versões do Charlie">
              {CHARLIE_VERSIONS.map((v, i) => (
                <button
                  key={v.slug}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={v.name}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    i === index ? "w-6 bg-hero" : "w-2 bg-[#FFE7D0]/25 hover:bg-[#FFE7D0]/45",
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Próxima versão"
              className="inline-flex h-10 w-10 items-center justify-center border border-hero/40 bg-[#1B1B1B] text-hero transition-colors hover:bg-hero hover:text-[#1B1B1B]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
