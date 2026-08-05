import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  initTikTokPixel,
  tiktokPage,
  tiktokTrack,
  tiktokTrackPurchaseOnce,
} from "@/lib/tiktok-pixel";

/**
 * Pixel TikTok no funil público (landing, auth, obrigado, parceiros).
 * PageView em toda navegação SPA; eventos-chave nas rotas de conversão.
 */
export function TikTokPixel() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    initTikTokPixel();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    tiktokPage();

    if (pathname === "/" || pathname === "") {
      tiktokTrack("ViewContent", { content_name: "landing" });
      return;
    }
    if (pathname === "/obrigado") {
      tiktokTrackPurchaseOnce();
    }
  }, [pathname]);

  return null;
}
