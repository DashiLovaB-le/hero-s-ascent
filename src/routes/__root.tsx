import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-hero">Perdido na jornada</p>
        <h1 className="mt-4 font-display text-7xl font-bold text-gradient-hero">404</h1>
        <p className="mt-4 text-muted-foreground">
          Este caminho não existe no mapa do herói.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Algo interrompeu sua jornada
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tente novamente ou volte para a base.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Tentar de novo
          </button>
          <a href="/" className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium hover:bg-accent">
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "V-Project — Desperte o herói dentro de você" },
      {
        name: "description",
        content:
          "Transforme seus dias em uma Jornada do Herói. Ganhe XP, evolua atributos e construa o homem que você quer se tornar — um hábito por vez.",
      },
      { name: "author", content: "V-Project" },
      { property: "og:title", content: "V-Project — Desperte o herói dentro de você" },
      {
        property: "og:description",
        content: "Transforme seus dias em uma Jornada do Herói. Ganhe XP, evolua atributos e construa o homem que você quer se tornar — um hábito por vez.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "V-Project — Desperte o herói dentro de você" },
      { name: "twitter:description", content: "Transforme seus dias em uma Jornada do Herói. Ganhe XP, evolua atributos e construa o homem que você quer se tornar — um hábito por vez." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/19f35a11-c472-4408-a384-43566acf00b7/id-preview-e0c8c509--cf587967-65c8-4d5b-92c8-76f0ab8cb3be.lovable.app-1784250446579.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/19f35a11-c472-4408-a384-43566acf00b7/id-preview-e0c8c509--cf587967-65c8-4d5b-92c8-76f0ab8cb3be.lovable.app-1784250446579.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/logo.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/logo.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600&display=swap",
      },
      {
        rel: "preload",
        href: "/images/hero-bg-mobile.png",
        as: "image",
        media: "(max-width: 767px)",
      },
      {
        rel: "preload",
        href: "/images/hero-bg-desktop.png",
        as: "image",
        media: "(min-width: 768px)",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        router.invalidate();
        return;
      }
      if (event === "SIGNED_IN") {
        router.invalidate();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
