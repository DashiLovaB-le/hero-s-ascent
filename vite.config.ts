// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Deploy na Vercel: gera .vercel/output (Build Output API) em vez do worker Cloudflare.
  // O default do Lovable é "cloudflare-module"; sobrescrevemos com o preset "vercel".
  nitro: {
    preset: "vercel",
  },
  vite: {
    // Windows + projeto grande: cold start do SSR pode passar de 60s e o module-runner
    // estoura `transport invoke timed out` ao importar virtual:tanstack-start-server-entry.
    // Ignorar pastas nativas/artefatos reduz I/O do watcher; warmup antecipa o grafo SSR.
    server: {
      watch: {
        ignored: [
          "**/android/**",
          "**/ios/**",
          "**/.vercel/**",
          "**/www/**",
          "**/.wrangler/**",
          "**/ml/.venv/**",
          "**/ml/**/__pycache__/**",
          "**/supabase/functions/**/.deno/**",
        ],
      },
      warmup: {
        ssrFiles: ["./src/server.ts", "./src/start.ts", "./src/router.tsx"],
      },
    },
  },
});
