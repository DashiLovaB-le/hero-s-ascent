import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Check, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { listCharliePersonalities, setCharliePersonality } from "@/mentor/functions";
import {
  charlieStoreImage,
  charlieStorePriceLabel,
} from "@/lib/charlie-store";
import { runQueryFn } from "@/lib/safe-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store")({
  component: CharlieStorePage,
});

type Product = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
};

function CharlieStorePage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCharliePersonalities);
  const setFn = useServerFn(setCharliePersonality);
  const [confirmSlug, setConfirmSlug] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["charlie-store"] as const,
    queryFn: () =>
      runQueryFn(() => listFn(), "Falha ao carregar a loja do Charlie."),
    staleTime: 60_000,
  });

  const products = (data?.personalities ?? []) as Product[];
  const currentSlug = data?.currentSlug ?? "classico";
  const pendingProduct = products.find((p) => p.slug === confirmSlug) ?? null;

  const activate = useMutation({
    mutationFn: (slug: string) => setFn({ data: { slug } }),
    onSuccess: (res) => {
      toast.success(`Charlie · ${res.personality.name}. Tom muda na próxima mensagem.`);
      setConfirmSlug(null);
      void qc.invalidateQueries({ queryKey: ["charlie-store"] });
      void qc.invalidateQueries({ queryKey: ["charlie-personalities"] });
      void qc.invalidateQueries({ queryKey: ["mentor-thread"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.24em] text-hero">Loja</p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Personalidades do Charlie</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Escolha o tom do mentor. A troca é real e vale a partir da próxima mensagem — o
            histórico antigo permanece.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/mentor">
            <ArrowLeft className="h-4 w-4" /> Voltar ao mentor
          </Link>
        </Button>
      </div>

      <Card className="flex items-center gap-3 border-hero/25 bg-hero/5 p-4">
        <ShoppingBag className="h-5 w-5 shrink-0 text-hero" />
        <p className="text-sm text-foreground/85">
          Escolha a melhor versão para o seu Charlie.
        </p>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando catálogo…</p>
      ) : null}

      {isError ? (
        <Card className="space-y-3 border-destructive/40 p-4">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Falha ao carregar."}
          </p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const active = p.slug === currentSlug;
          const price = charlieStorePriceLabel(p.slug);
          return (
            <article
              key={p.slug}
              className={cn(
                "cp-panel cp-brackets flex flex-col overflow-hidden border border-transparent bg-card/90",
                active ? "bg-hero/10 shadow-hero" : "",
              )}
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-black">
                <img
                  src={charlieStoreImage(p.slug)}
                  alt={p.name}
                  className="h-full w-full object-cover object-top"
                />
                {active ? (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 bg-hero px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-hero-foreground">
                    <Check className="h-3 w-3" /> Em uso
                  </span>
                ) : null}
                <span className="absolute bottom-2 right-2 bg-black/75 px-2 py-0.5 font-mono text-xs text-hero">
                  {price}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div>
                  <h2 className="font-display text-lg leading-tight">{p.name}</h2>
                  <p className="mt-1 text-xs text-hero/90">{p.tagline}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                </div>
                <div className="mt-auto pt-3">
                  {active ? (
                    <Button className="w-full" variant="secondary" disabled>
                      Personalidade ativa
                    </Button>
                  ) : (
                    <Button
                      className="w-full shadow-hero"
                      disabled={activate.isPending}
                      onClick={() => setConfirmSlug(p.slug)}
                    >
                      Ativar · {price}
                    </Button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <AlertDialog
        open={Boolean(confirmSlug)}
        onOpenChange={(open) => {
          if (!open) setConfirmSlug(null);
        }}
      >
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Ativar {pendingProduct?.name ?? "esta personalidade"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              O Charlie passa a falar neste tom a partir da próxima mensagem.{" "}
              {pendingProduct?.tagline}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={activate.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-hero text-hero-foreground hover:bg-hero/90"
              disabled={!confirmSlug || activate.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!confirmSlug) return;
                activate.mutate(confirmSlug);
              }}
            >
              {activate.isPending ? "Ativando…" : "Confirmar escolha"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
