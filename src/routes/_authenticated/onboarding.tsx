import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, ArrowRight, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { setGoals } from "@/lib/journey.functions";
import {
  suggestHabitsFromGoals,
  createHabitsBulk,
  type HabitSuggestion,
} from "@/lib/habit-suggest";
import { CATEGORIAS, ATRIBUTO_LABELS } from "@/lib/journey";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const SUGESTOES: Record<string, string[]> = {
  corpo: ["Treinar 4x na semana", "Dormir 7h por noite", "Beber 3L de água"],
  mente: ["Ler 20 min por dia", "Meditar 10 min", "Zero redes sociais até meio-dia"],
  espirito: ["Gratidão diária", "Journaling matinal", "Silêncio 15 min"],
  prosperidade: ["Estudar minha área 1h/dia", "Economizar 20% da renda"],
  relacionamentos: ["Ligar para família 1x/semana", "Encontro semanal com amigos"],
  proposito: ["Trabalhar no meu projeto 1h/dia", "Escrever meu manifesto pessoal"],
};

type Cat = "corpo" | "mente" | "espirito" | "prosperidade" | "relacionamentos" | "proposito";

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setFn = useServerFn(setGoals);
  const suggestFn = useServerFn(suggestHabitsFromGoals);
  const bulkFn = useServerFn(createHabitsBulk);

  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [metas, setMetas] = useState<{ categoria: string; titulo: string }[]>([]);
  const [suggestions, setSuggestions] = useState<HabitSuggestion[]>([]);
  const [suggestSource, setSuggestSource] = useState<"ai" | "fallback" | null>(null);

  const suggestM = useMutation({
    mutationFn: () =>
      suggestFn({
        data: {
          goals: metas as { categoria: Cat; titulo: string }[],
          categories: [...selecionadas] as Cat[],
        },
      }),
    onSuccess: (res) => {
      setSuggestions(res.habits);
      setSuggestSource(res.source);
      setStep(3);
    },
    onError: (e) => toast.error(e.message),
  });

  const finishM = useMutation({
    mutationFn: async () => {
      await setFn({
        data: {
          goals: metas as { categoria: Cat; titulo: string }[],
        },
      });
      if (suggestions.length > 0) {
        await bulkFn({ data: { habits: suggestions } });
      }
    },
    onSuccess: () => {
      toast.success("Sua jornada está pronta.");
      void qc.invalidateQueries();
      navigate({ to: "/journey", replace: true });
    },
    onError: (e) => toast.error(e.message),
  });

  function toggleCat(id: string) {
    const n = new Set(selecionadas);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelecionadas(n);
  }

  function proceedToMetas() {
    if (selecionadas.size === 0) return toast.error("Escolha ao menos uma área.");
    const iniciais = [...selecionadas].flatMap((cat) =>
      (SUGESTOES[cat] ?? []).slice(0, 2).map((titulo) => ({ categoria: cat, titulo })),
    );
    setMetas(iniciais);
    setStep(2);
  }

  function skipHabits() {
    finishM.mutate();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-hero">Passo {step} de 3</p>
        <h1 className="mt-2 font-display text-3xl font-bold">
          {step === 1
            ? "Onde você quer evoluir?"
            : step === 2
              ? "Suas primeiras metas"
              : "Hábitos sugeridos"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {step === 1
            ? "Escolha 2 a 4 áreas de foco."
            : step === 2
              ? "Ajuste ou adicione o que fizer sentido."
              : suggestSource === "ai"
                ? "Charlie montou uma rotina. Revise antes de confirmar."
                : "Sugestões prontas — edite ou remova o que quiser."}
        </p>
      </div>

      {step === 1 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {CATEGORIAS.map((c) => {
              const on = selecionadas.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCat(c.id)}
                  className={`cp-panel flex items-center gap-4 border border-transparent p-4 text-left transition-[filter,background-color] ${
                    on ? "bg-hero/10 brightness-110" : "bg-card/90 hover:brightness-110"
                  }`}
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <div className="flex-1">
                    <p className="font-display font-semibold">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.descricao}</p>
                  </div>
                  {on && <Check className="h-5 w-5 text-hero" />}
                </button>
              );
            })}
          </div>
          <Button
            onClick={proceedToMetas}
            className="cp-panel w-full rounded-none shadow-hero [--cp-cut:10px]"
            size="lg"
          >
            Continuar <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </>
      )}

      {step === 2 && (
        <Card className="border-transparent bg-card/90 p-6">
          <div className="space-y-3">
            {metas.map((meta, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-lg">
                  {CATEGORIAS.find((c) => c.id === meta.categoria)?.emoji}
                </span>
                <Input
                  value={meta.titulo}
                  onChange={(e) => {
                    const c = [...metas];
                    c[i] = { ...c[i], titulo: e.target.value };
                    setMetas(c);
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setMetas(metas.filter((_, x) => x !== i))}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="rounded-none" type="button" onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button
              type="button"
              onClick={() => suggestM.mutate()}
              disabled={suggestM.isPending || metas.length === 0}
              className="flex-1 rounded-none shadow-hero"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {suggestM.isPending ? "Gerando…" : "Gerar hábitos com Charlie"}
            </Button>
          </div>
          <button
            type="button"
            className="mt-3 w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={skipHabits}
            disabled={finishM.isPending || metas.length === 0}
          >
            Pular e criar hábitos depois
          </button>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-transparent bg-card/90 p-6">
          <div className="space-y-3">
            {suggestions.map((h, i) => (
              <div key={i} className="space-y-2 border border-border bg-surface/80 p-3">
                <div className="flex gap-2">
                  <Input
                    value={h.titulo}
                    onChange={(e) => {
                      const next = [...suggestions];
                      next[i] = { ...next[i], titulo: e.target.value };
                      setSuggestions(next);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSuggestions(suggestions.filter((_, x) => x !== i))}
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ATRIBUTO_LABELS[h.atributo]} · {h.categoria} · +{h.xp_recompensa} XP
                </p>
              </div>
            ))}
            {suggestions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum hábito selecionado. Você pode criar depois em Hábitos.
              </p>
            )}
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="rounded-none" type="button" onClick={() => setStep(2)}>
              Voltar
            </Button>
            <Button
              type="button"
              onClick={() => finishM.mutate()}
              disabled={finishM.isPending}
              className="flex-1 rounded-none shadow-hero"
            >
              {finishM.isPending ? "Salvando…" : "Iniciar minha jornada"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
