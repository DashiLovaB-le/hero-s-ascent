import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { JOURNEY_STALE_MS } from "@/lib/journey-queries";

function shouldReduceMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: JOURNEY_STALE_MS,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: JOURNEY_STALE_MS,
    // Evita commit prematuro de matches pending (race com beforeLoad async → Uncaught undefined).
    defaultPendingMs: 1_000,
    defaultPendingMinMs: 0,
    // View Transitions API — sem remount via key={pathname}
    defaultViewTransition: {
      types: () => (shouldReduceMotion() ? false : ["page-fade"]),
    },
  });

  return router;
};
