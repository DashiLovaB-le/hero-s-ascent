import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { trackPageView } from "@/lib/page-views.functions";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "vp_pv_sid";

function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 32)
        : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Registra page views em navegação (ignora sala de controle no server). */
export function PageViewTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const trackFn = useServerFn(trackPageView);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;

    let cancelled = false;
    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        await trackFn({
          data: {
            path: pathname,
            session_id: getOrCreateSessionId(),
            referrer: document.referrer || null,
            user_id: session?.user?.id ?? null,
          },
        });
      } catch {
        // analytics best-effort
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, trackFn]);

  return null;
}
