import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/motion-prefs";

/**
 * Stagger leve de blocos (ex.: cards da Jornada).
 * Sem translateY no shell de rota — transform no Outlet fazia o navbar
 * (backdrop-blur) piscar/sumir por um frame em vários browsers.
 * Aqui só opacity nos cards, no mount da página.
 */
export function useStaggerEnter(
  rootRef: RefObject<HTMLElement | null>,
  selector = "[data-app-enter]",
) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;

    const items = root.querySelectorAll<HTMLElement>(selector);
    if (!items.length) return;

    const tween = gsap.from(items, {
      opacity: 0.35,
      duration: 0.28,
      stagger: 0.04,
      ease: "power2.out",
      overwrite: "auto",
      clearProps: "opacity",
    });

    return () => {
      tween.kill();
      gsap.set(items, { clearProps: "opacity" });
    };
    // Mount-only: não re-anima ao completar hábito / refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only enter
  }, []);
}

/** Pulso curto no check de hábito — não bloqueia clique nem cobre a nav. */
export function pulseHabitComplete(el: HTMLElement | null | undefined) {
  if (!el || prefersReducedMotion()) return;
  gsap.fromTo(
    el,
    { scale: 1 },
    {
      scale: 1.14,
      duration: 0.14,
      yoyo: true,
      repeat: 1,
      ease: "power2.out",
      overwrite: true,
      transformOrigin: "50% 50%",
      onComplete: () => {
        gsap.set(el, { clearProps: "transform" });
      },
    },
  );
}

/** Flash discreto no badge de streak quando sobe. */
export function pulseStreakBadge(el: HTMLElement | null | undefined) {
  if (!el || prefersReducedMotion()) return;
  gsap.fromTo(
    el,
    { scale: 1 },
    {
      scale: 1.08,
      duration: 0.16,
      yoyo: true,
      repeat: 1,
      ease: "power2.out",
      overwrite: true,
      transformOrigin: "50% 50%",
      onComplete: () => {
        gsap.set(el, { clearProps: "transform" });
      },
    },
  );
}
