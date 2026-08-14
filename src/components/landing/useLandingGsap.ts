import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Animações da landing (priorizadas):
 * 1. Reveal das seções no scroll
 * 2. Timeline do hero + Ken Burns leve no bg
 * 3. Parallax do fundo do hero
 * 4. Linhas da seção "A Dor"
 * 5. Stagger dos atributos
 * 6. Pin leve do Charlie (desktop)
 * 7. Stagger "Para homens que…"
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
        // ── 2. Hero timeline + Ken Burns ──
        const heroBg = root.querySelector<HTMLElement>("[data-lp='hero-bg']");
        if (heroBg) {
          gsap.fromTo(
            heroBg,
            { scale: 1.08 },
            {
              scale: 1,
              duration: 1.55,
              ease: "power2.out",
              transformOrigin: "50% 40%",
            },
          );
        }

        const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
        heroTl
          .from("[data-lp='hero-brand']", { autoAlpha: 0, y: 16, duration: 0.55 })
          .from("[data-lp='hero-title']", { autoAlpha: 0, y: 28, duration: 0.7 }, "-=0.25")
          .from("[data-lp='hero-sub']", { autoAlpha: 0, y: 18, duration: 0.5 }, "-=0.35")
          .from("[data-lp='hero-copy']", { autoAlpha: 0, y: 14, duration: 0.45 }, "-=0.28")
          .from("[data-lp='hero-cta']", { autoAlpha: 0, y: 12, duration: 0.4 }, "-=0.22");

        // ── 3. Parallax leve no hero bg ──
        if (heroBg) {
          gsap.to(heroBg, {
            yPercent: 12,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-lp='hero']",
              start: "top top",
              end: "bottom top",
              scrub: true,
            },
          });
        }

        // ── 1. Reveal das seções (pula Dor / Para quem — têm timelines próprias) ──
        gsap.utils.toArray<HTMLElement>("[data-lp='section']").forEach((section) => {
          if (
            section.querySelector("[data-lp='dor-lines']") ||
            section.querySelector("[data-lp='for-who']")
          ) {
            return;
          }

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

        // ── 4. A Dor — intro + linhas em sequência ──
        const dorLines = root.querySelector<HTMLElement>("[data-lp='dor-lines']");
        if (dorLines) {
          const dorSection = dorLines.closest<HTMLElement>("[data-lp='section']");
          const dorInner =
            dorSection?.querySelector<HTMLElement>("[data-lp='section-inner']") ?? null;
          const dorIntro = dorInner
            ? gsap.utils
                .toArray<HTMLElement>(dorInner.children)
                .filter((el) => el !== dorLines)
            : [];
          const lines = gsap.utils.toArray<HTMLElement>(
            dorLines.querySelectorAll("[data-lp='dor-line']"),
          );
          const punch = dorLines.querySelector<HTMLElement>("[data-lp='dor-punch']");
          const card = dorLines.querySelector<HTMLElement>("[data-lp='dor-card']");

          const dorTl = gsap.timeline({
            defaults: { ease: "power3.out" },
            scrollTrigger: {
              trigger: dorSection ?? dorLines,
              start: "top 78%",
              toggleActions: "play none none none",
            },
          });

          if (dorIntro.length) {
            dorTl.from(dorIntro, {
              autoAlpha: 0,
              y: 22,
              duration: 0.55,
              stagger: 0.08,
            });
          }
          if (lines.length) {
            dorTl.from(
              lines,
              {
                autoAlpha: 0,
                y: 14,
                duration: 0.42,
                stagger: 0.11,
              },
              "-=0.15",
            );
          }
          if (punch) {
            dorTl.from(punch, { autoAlpha: 0, y: 18, duration: 0.55 }, "-=0.05");
          }
          if (card) {
            dorTl.from(card, { autoAlpha: 0, y: 20, duration: 0.5 }, "-=0.12");
          }
        }

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

        // ── 7. Para homens que… ──
        const forWhoList = root.querySelector<HTMLElement>("[data-lp='for-who']");
        const forWhoItems = gsap.utils.toArray<HTMLElement>("[data-lp='for-who-item']");
        if (forWhoList && forWhoItems.length) {
          const forWhoSection = forWhoList.closest<HTMLElement>("[data-lp='section']");
          const forWhoInner =
            forWhoSection?.querySelector<HTMLElement>("[data-lp='section-inner']") ?? null;
          const forWhoIntro = forWhoInner
            ? gsap.utils
                .toArray<HTMLElement>(forWhoInner.children)
                .filter((el) => el !== forWhoList)
            : [];

          const forWhoTl = gsap.timeline({
            defaults: { ease: "power3.out" },
            scrollTrigger: {
              trigger: forWhoSection ?? forWhoList,
              start: "top 82%",
              toggleActions: "play none none none",
            },
          });

          if (forWhoIntro.length) {
            forWhoTl.from(forWhoIntro, {
              autoAlpha: 0,
              y: 20,
              duration: 0.5,
              stagger: 0.06,
            });
          }
          forWhoTl.from(
            forWhoItems,
            {
              autoAlpha: 0,
              x: -14,
              duration: 0.45,
              stagger: 0.07,
            },
            "-=0.12",
          );
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
