import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { listCharliePersonalities, setCharliePersonality } from "@/mentor/functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { runQueryFn } from "@/lib/safe-query";

type PersonalitySummary = {
  slug: string;
  name: string;
  tagline: string;
};

type Props = {
  current: PersonalitySummary;
  onChanged?: (next: PersonalitySummary) => void;
};

export function CharliePersonalityPicker({ current, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const listFn = useServerFn(listCharliePersonalities);
  const setFn = useServerFn(setCharliePersonality);

  const { data, isLoading } = useQuery({
    queryKey: ["charlie-personalities"],
    queryFn: () => runQueryFn(() => listFn(), "Falha ao listar personalidades."),
    enabled: open,
    staleTime: 60_000,
  });

  const select = useMutation({
    mutationFn: (slug: string) => setFn({ data: { slug } }),
    onSuccess: (res) => {
      toast.success(`Charlie · ${res.personality.name}. Tom muda na próxima mensagem.`);
      onChanged?.(res.personality);
      void qc.invalidateQueries({ queryKey: ["mentor-thread"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex max-w-full items-center gap-1.5 text-left text-xs text-hero/90 hover:text-hero"
      >
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {current.name}
          {current.tagline ? ` · ${current.tagline}` : ""}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Escolher personalidade do Charlie"
            className="max-h-[85vh] w-full max-w-lg overflow-hidden border border-white/10 bg-[#0c0c0c] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-hero">Charlie</p>
                <h2 className="font-display text-lg font-semibold">Escolher personalidade</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[70vh] space-y-2 overflow-y-auto p-4">
              <p className="mb-3 text-sm text-muted-foreground">
                O tom muda a partir da próxima mensagem. O histórico antigo permanece.
              </p>
              {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
              {(data?.personalities ?? []).map((p) => {
                const active = p.slug === current.slug;
                return (
                  <button
                    key={p.slug}
                    type="button"
                    disabled={select.isPending}
                    onClick={() => {
                      if (active) {
                        setOpen(false);
                        return;
                      }
                      select.mutate(p.slug);
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 border px-3 py-3 text-left transition",
                      active
                        ? "border-hero/60 bg-hero/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{p.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.tagline}</p>
                      <p className="mt-1 text-xs text-white/45">{p.description}</p>
                    </div>
                    {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-hero" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
