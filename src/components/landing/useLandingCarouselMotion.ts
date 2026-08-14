import { useLayoutEffect, useRef, type RefObject } from "react";
import gsap from "gsap";

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Crossfade suave ao trocar slides/versões na landing.
 * Marque alvos com `data-lp-carousel` dentro de `stageRef`.
 */
export function useLandingCarouselMotion(
  index: number,
  stageRef: RefObject<HTMLElement | null>,
) {
  const isFirst = useRef(true);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    if (prefersReducedMotion()) return;

    const nodes = Array.from(
      stage.querySelectorAll<HTMLElement>("[data-lp-carousel]"),
    );
    if (!nodes.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        nodes,
        { autoAlpha: 0, y: 10, scale: 0.985 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.38,
          stagger: 0.04,
          ease: "power2.out",
          clearProps: "transform",
        },
      );
    }, stage);

    return () => {
      ctx.revert();
    };
  }, [index, stageRef]);
}
