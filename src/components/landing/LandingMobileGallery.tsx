import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SlashLabel } from "@/components/landing/LandingChrome";
import { useLandingCarouselMotion } from "@/components/landing/useLandingCarouselMotion";
import { cn } from "@/lib/utils";

const MOBILE_SLIDES = [
  {
    src: "/lp-images/slide-mobile-02.png",
    alt: "V-Project no celular — Jornada",
    title: "Jornada",
    body: "Seu dashboard do dia: nível, XP, streak, check-in e o ritmo que sustenta a evolução.",
  },
  {
    src: "/lp-images/slide-mobile-03.png",
    alt: "V-Project no celular — Hábitos",
    title: "Hábitos",
    body: "Missões diárias com recompensa real — marque o feito, fortaleça atributos e mantenha a sequência.",
  },
  {
    src: "/lp-images/slide-mobile-04.png",
    alt: "V-Project no celular — Charlie",
    title: "Charlie",
    body: "Mentor com IA 24h: conversa, desafios e sugestões no tom da sua jornada — não é chatbot genérico.",
  },
  {
    src: "/lp-images/slide-mobile-05.png",
    alt: "V-Project no celular — Metas",
    title: "Metas",
    body: "Nortes com prazo e motivo. Ligue hábitos ao que importa e acompanhe o progresso da semana.",
  },
  {
    src: "/lp-images/slide-mobile-01.png",
    alt: "V-Project no celular — Perfil",
    title: "Perfil",
    body: "Identidade do herói: atributos, conquistas, localização e o panorama da sua evolução.",
  },
] as const;

export function LandingMobileGallery() {
  const [index, setIndex] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const total = MOBILE_SLIDES.length;
  const slide = MOBILE_SLIDES[index]!;

  useLandingCarouselMotion(index, stageRef);

  function go(delta: number) {
    setIndex((i) => (i + delta + total) % total);
  }

  return (
    <section data-lp="section" className="relative bg-[#1B1B1B] px-5 py-10 sm:px-6 sm:py-14">
      <div className="pointer-events-none absolute inset-0 lp-grid-bg opacity-30" aria-hidden />
      <div
        ref={stageRef}
        data-lp="section-inner"
        className="relative mx-auto grid max-w-4xl items-center gap-6 md:grid-cols-[1fr_auto] md:gap-8 lg:gap-10"
      >
        <div className="min-w-0 text-center md:text-left">
          <SlashLabel bar={false} className="w-full justify-center md:justify-start">
            V-PROJECT // NO CELULAR
          </SlashLabel>
          <h2 className="mt-3 font-display text-xl font-bold tracking-[0.04em] text-[#FFE7D0] sm:text-2xl">
            A jornada no bolso.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#FFE7D0]/65 md:mx-0">
            Cinco telas. Um sistema. No seu ritmo, onde você estiver.
          </p>

          <div
            data-lp-carousel
            className="mt-5 border-l-2 border-hero/50 bg-[#323232]/50 px-4 py-3 text-left"
          >
            <p className="font-display text-sm tracking-[0.06em] text-hero">{slide.title}</p>
            <p className="mt-1.5 text-sm leading-snug text-white">{slide.body}</p>
          </div>

          <ul className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
            {MOBILE_SLIDES.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  className={cn(
                    "border px-2.5 py-1 font-sans text-[10px] uppercase tracking-[0.14em] transition-colors",
                    i === index
                      ? "border-hero bg-hero text-[#1B1B1B]"
                      : "border-[#FFE7D0]/20 text-[#FFE7D0]/55 hover:border-hero/50 hover:text-[#FFE7D0]",
                  )}
                >
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-center justify-self-center md:justify-self-end">
          <div className="relative">
            <div
              data-lp-carousel
              className="overflow-hidden border-[3px] border-[#444] bg-[#0d0d0d] shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
              style={{
                width: "min(260px, 70vw)",
                aspectRatio: "9 / 18",
                borderRadius: "1.75rem",
              }}
            >
              <img
                src={slide.src}
                alt={slide.alt}
                width={260}
                height={520}
                className="h-full w-full object-cover object-top"
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            </div>

            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Tela anterior"
              className="absolute left-0 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-hero/40 bg-[#1B1B1B]/95 text-hero transition-colors hover:bg-hero hover:text-[#1B1B1B]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Próxima tela"
              className="absolute right-0 top-1/2 z-10 flex h-9 w-9 translate-x-1/2 -translate-y-1/2 items-center justify-center border border-hero/40 bg-[#1B1B1B]/95 text-hero transition-colors hover:bg-hero hover:text-[#1B1B1B]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2" role="tablist" aria-label="Telas do app">
            {MOBILE_SLIDES.map((s, i) => (
              <button
                key={s.src}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${s.title}: tela ${i + 1} de ${total}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === index ? "w-6 bg-hero" : "w-2 bg-[#FFE7D0]/25 hover:bg-[#FFE7D0]/45",
                )}
              />
            ))}
          </div>

          <p className="mt-2 font-mono text-[10px] tracking-[0.2em] text-[#FFE7D0]/40">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </p>
        </div>
      </div>
    </section>
  );
}
