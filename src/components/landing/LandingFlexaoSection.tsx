import { SlashLabel, CheckItem } from "@/components/landing/LandingChrome";

/** Coloque o demo em public/lp-images/flexao-demo.mp4 (proporção ~9:16). */
const FLEXAO_DEMO_SRC = "/lp-images/flexao-demo.mp4";
const FLEXAO_POSTER = "/lp-images/slide-mobile-01.png";

const HIGHLIGHTS = [
  "A câmera enquadra o corpo e calibra a amplitude.",
  "A visão por pose acompanha cada repetição em tempo real.",
  "Conta reps válidas vs inválidas e mede a qualidade do movimento.",
] as const;

export function LandingFlexaoSection() {
  return (
    <section data-lp="section" className="relative bg-[#323232] px-5 py-10 sm:px-6 sm:py-14">
      <div className="pointer-events-none absolute inset-0 lp-grid-bg opacity-30" aria-hidden />
      <div data-lp="section-inner" className="relative mx-auto max-w-5xl">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_minmax(0,280px)] lg:gap-10">
          <div className="min-w-0">
            <SlashLabel>V-PROJECT // FLEXÃO VALIDADA</SlashLabel>
            <h2 className="mt-3.5 font-display text-xl font-bold tracking-[0.04em] text-[#FFE7D0] sm:text-2xl lg:text-3xl">
              A plataforma vê a execução — e conta o que foi feito de verdade.
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-[#FFE7D0]/65">
              Na sessão de flexão, o V-Project usa a câmera do celular para acompanhar o movimento:
              enquadramento, calibração e contagem automática. Sem honra no aplicativo. Rep só vale
              se a forma passar.
            </p>

            <ul className="mt-5 space-y-2.5">
              {HIGHLIGHTS.map((item) => (
                <CheckItem key={item}>{item}</CheckItem>
              ))}
            </ul>

            <div className="lp-card cp-brackets mt-5 p-4 sm:p-5">
              <p className="font-display text-[11px] uppercase tracking-[0.22em] text-hero">
                No fim da série
              </p>
              <p className="mt-2 text-sm text-[#FFE7D0]/75">
                Você vê reps válidas, inválidas e um indicador de forma — progresso físico ligado à
                jornada, não a um checkbox genérico.
              </p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[260px] lg:mx-0 lg:justify-self-end">
            <p className="mb-3 text-center font-mono text-[10px] tracking-[0.22em] text-[#FFE7D0]/45 lg:text-right">
              DEMO · FORMATO MOBILE
            </p>
            <div
              className="relative overflow-hidden border-[3px] border-[#444] bg-[#0d0d0d] shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
              style={{ borderRadius: "1.75rem", aspectRatio: "9 / 18" }}
            >
              <video
                className="h-full w-full object-cover object-center"
                src={FLEXAO_DEMO_SRC}
                poster={FLEXAO_POSTER}
                controls
                playsInline
                muted
                loop
                preload="metadata"
                aria-label="Demonstração da sessão de flexão validada no celular"
              >
                Seu navegador não reproduz vídeo.
              </video>
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/50 to-transparent"
                aria-hidden
              />
              <span
                className="pointer-events-none absolute left-3 top-2.5 font-mono text-[9px] tracking-[0.18em] text-hero/90"
                aria-hidden
              >
                CAM // POSE
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
