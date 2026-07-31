import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Animações da landing (priorizadas):
 * 1. Reveal das seções no scroll
 * 2. Timeline do hero
 * 3. Parallax do fundo do hero
 * 5. Stagger dos atributos
 * 6. Pin leve do Charlie (desktop)
 * 8. Count-up do preço
 * 10. Respeita prefers-reduced-motion
 */
export function useLandingGsap(rootRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // ── 2. Hero timeline ──
        const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
        heroTl
          .from("[data-lp='hero-brand']", { autoAlpha: 0, y: 16, duration: 0.55 })
          .from("[data-lp='hero-title']", { autoAlpha: 0, y: 28, duration: 0.7 }, "-=0.25")
          .from("[data-lp='hero-sub']", { autoAlpha: 0, y: 18, duration: 0.5 }, "-=0.35")
          .from("[data-lp='hero-copy']", { autoAlpha: 0, y: 14, duration: 0.45 }, "-=0.28")
          .from("[data-lp='hero-cta']", { autoAlpha: 0, y: 12, duration: 0.4 }, "-=0.22");

        // ── 3. Parallax leve no hero bg ──
        gsap.to("[data-lp='hero-bg']", {
          yPercent: 12,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-lp='hero']",
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });

        // ── 1. Reveal das seções ──
        gsap.utils.toArray<HTMLElement>("[data-lp='section']").forEach((section) => {
          const content =
            section.querySelector<HTMLElement>("[data-lp='section-inner']") ?? section;

          gsap.from(content, {
            autoAlpha: 0,
            y: 36,
            duration: 0.75,
            ease: "power3.out",
            scrollTrigger: {
              trigger: section,
              start: "top 82%",
              toggleActions: "play none none none",
            },
          });
        });

        // ── 5. Stagger atributos ──
        const attrs = gsap.utils.toArray<HTMLElement>("[data-lp='attr']");
        if (attrs.length) {
          gsap.from(attrs, {
            autoAlpha: 0,
            y: 24,
            skewY: 2,
            duration: 0.55,
            stagger: 0.06,
            ease: "power3.out",
            scrollTrigger: {
              trigger: "[data-lp='attrs']",
              start: "top 80%",
              toggleActions: "play none none none",
            },
          });
        }

        // Steps stagger (bônus leve)
        const steps = gsap.utils.toArray<HTMLElement>("[data-lp='step']");
        if (steps.length) {
          gsap.from(steps, {
            autoAlpha: 0,
            y: 20,
            duration: 0.5,
            stagger: 0.08,
            ease: "power3.out",
            scrollTrigger: {
              trigger: "[data-lp='steps']",
              start: "top 82%",
              toggleActions: "play none none none",
            },
          });
        }

        // ── 8. Count-up preço ──
        const priceEl = root.querySelector<HTMLElement>("[data-lp='price-num']");
        if (priceEl) {
          const state = { val: 0 };
          gsap.to(state, {
            val: 97,
            duration: 1.15,
            ease: "power2.out",
            scrollTrigger: {
              trigger: "[data-lp='price']",
              start: "top 78%",
              toggleActions: "play none none none",
            },
            onUpdate: () => {
              priceEl.textContent = String(Math.round(state.val));
            },
          });
        }

        // ── 6. Charlie pin + scrub (desktop) ──
        const mmDesktop = gsap.matchMedia();
        mmDesktop.add("(min-width: 768px)", () => {
          const panel = root.querySelector<HTMLElement>("[data-lp='charlie-panel']");
          const section = root.querySelector<HTMLElement>("[data-lp='charlie']");
          if (!panel || !section) return;

          gsap.fromTo(
            panel,
            { y: 28, autoAlpha: 0.85, scale: 0.985 },
            {
              y: 0,
              autoAlpha: 1,
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: section,
                start: "top 70%",
                end: "top 28%",
                scrub: true,
              },
            },
          );
        });
      });
    }, root);

    return () => {
      ctx.revert();
    };
  }, [rootRef]);
}
