import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Flame, LayoutDashboard, ScrollText } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { markProductTourSeen, writeLocalTourSeen } from "@/lib/product-tour.functions";

type ProductTourProps = {
  open: boolean;
  userId: string;
  onComplete: () => void;
};

type TourSlide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: ReactNode;
};

const SLIDES: TourSlide[] = [
  {
    id: "welcome",
    eyebrow: "BOAS-VINDAS",
    title: "Bem-vindo à V-Project",
    body: "Sua jornada de evolução pessoal vira um jogo: hábitos diários, XP, missões e um mentor ao seu lado.",
    icon: (
      <img
        src="/animate-icons/journey-.gif"
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 object-contain"
        aria-hidden
      />
    ),
  },
  {
    id: "journey",
    eyebrow: "JORNADA",
    title: "Acompanhe seu progresso",
    body: "Na Jornada você vê nível, streak, atributos e o clima do dia. É o painel central da sua evolução.",
    icon: <LayoutDashboard className="h-7 w-7 text-hero" aria-hidden />,
  },
  {
    id: "habits",
    eyebrow: "HÁBITOS",
    title: "Complete hábitos e ganhe XP",
    body: "Cada hábito concluído soma experiência e fortalece atributos. A consistência mantém seu streak vivo.",
    icon: <Flame className="h-7 w-7 text-hero" aria-hidden />,
  },
  {
    id: "missions",
    eyebrow: "MISSÕES",
    title: "Missões do capítulo",
    body: "Cada capítulo traz missões principal e secundária. Cumpri-las libera recompensas extras de XP.",
    icon: <ScrollText className="h-7 w-7 text-hero" aria-hidden />,
  },
  {
    id: "charlie",
    eyebrow: "MENTOR",
    title: "Charlie te acompanha",
    body: "O Charlie é seu mentor: conversa, desafia e ajusta o ritmo. Use-o quando precisar de direção.",
    icon: (
      <img
        src="/charlie.png"
        alt=""
        className="h-8 w-8 rounded-full object-cover object-top ring-1 ring-hero/50"
        aria-hidden
      />
    ),
  },
  {
    id: "goals",
    eyebrow: "METAS E PERFIL",
    title: "Defina o destino",
    body: "Metas guiam seus hábitos. No Perfil você vê o panorama completo e personaliza a experiência.",
    icon: (
      <img
        src="/animate-icons/target-.gif"
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 object-contain"
        aria-hidden
      />
    ),
  },
];

export function ProductTour({ open, userId, onComplete }: ProductTourProps) {
  const [step, setStep] = useState(0);
  const markSeen = useServerFn(markProductTourSeen);

  const finishM = useMutation({
    mutationFn: async () => {
      writeLocalTourSeen(userId);
      return markSeen();
    },
    onSuccess: () => onComplete(),
    onError: () => {
      writeLocalTourSeen(userId);
      onComplete();
    },
  });

  const slide = SLIDES[step]!;
  const isLast = step === SLIDES.length - 1;
  const isFirst = step === 0;

  function goNext() {
    if (isLast) {
      if (!finishM.isPending) finishM.mutate();
      return;
    }
    setStep((s) => Math.min(s + 1, SLIDES.length - 1));
  }

  function goPrev() {
    setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-[min(26rem,calc(100vw-1.5rem))] gap-0 overflow-hidden border-border/60 bg-card p-0 sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="relative px-5 pb-5 pt-6 sm:px-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="font-display text-[0.65rem] tracking-[0.28em] text-hero">{slide.eyebrow}</p>
            <p className="font-display text-[0.65rem] tracking-wider text-muted-foreground">
              {step + 1}/{SLIDES.length}
            </p>
          </div>

          <div
            key={slide.id}
            className="animate-in fade-in-0 slide-in-from-right-2 duration-200"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-hero/25 bg-hero/10">
              {slide.icon}
            </div>

            <DialogTitle className="font-display text-xl leading-tight tracking-wide text-foreground">
              {slide.title}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {slide.body}
            </DialogDescription>
          </div>

          <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden>
            {SLIDES.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-5 bg-hero" : "w-1.5 bg-muted-foreground/35"
                }`}
              />
            ))}
          </div>

          <div className="mt-5 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={isFirst || finishM.isPending}
              onClick={goPrev}
              aria-label="Slide anterior"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              className="h-10 flex-1 shadow-hero"
              disabled={finishM.isPending}
              onClick={goNext}
            >
              {isLast ? (
                finishM.isPending ? "Salvando…" : "Entendi"
              ) : (
                <>
                  Próximo <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
