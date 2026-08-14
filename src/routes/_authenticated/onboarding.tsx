import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, ArrowRight, Sparkles, Trash2, Swords } from "lucide-react";
import { toast } from "sonner";

import { setGoals } from "@/lib/journey.functions";
import {
  suggestHabitsFromGoals,
  createHabitsBulk,
  type HabitSuggestion,
} from "@/lib/habit-suggest";
import { synthesizeHeroAlterEgo, upsertHeroAlterEgo } from "@/lib/alter-ego.functions";
import {
  ALTER_EGO_INIMIGOS,
  ALTER_EGO_VIRTUDES,
  type HeroAlterEgo,
} from "@/lib/alter-ego";
import { CATEGORIAS, ATRIBUTO_LABELS } from "@/lib/journey";
import { markPendingProductTour } from "@/lib/product-tour";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  const upsertEgoFn = useServerFn(upsertHeroAlterEgo);
  const synthFn = useServerFn(synthesizeHeroAlterEgo);

  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [metas, setMetas] = useState<{ categoria: string; titulo: string }[]>([]);
  const [suggestions, setSuggestions] = useState<HabitSuggestion[]>([]);
  const [suggestSource, setSuggestSource] = useState<"ai" | "fallback" | null>(null);

  const [virtude, setVirtude] = useState<string>(ALTER_EGO_VIRTUDES[0]);
  const [inimigo, setInimigo] = useState<string>(ALTER_EGO_INIMIGOS[0]);
  const [reconhecimento, setReconhecimento] = useState("");
  const [draftEgo, setDraftEgo] = useState<HeroAlterEgo | null>(null);
  const [egoSource, setEgoSource] = useState<"ai" | "fallback" | null>(null);

  const synthM = useMutation({
    mutationFn: () =>
      synthFn({
        data: {
          answers: {
            virtude,
            inimigo,
            reconhecimento: reconhecimento.trim() || "homem que cumpre o que promete",
          },
          goals: metas as { categoria: string; titulo: string }[],
        },
      }),
    onSuccess: (res) => {
      setDraftEgo(res.alterEgo);
      setEgoSource(res.source);
      toast.success(
        res.source === "ai"
          ? "Charlie sintetizou sua identidade."
          : "Identidade pronta — revise o código.",
      );
    },
    onError: (e) => toast.error(e.message),
  });

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
      setStep(4);
    },
    onError: (e) => toast.error(e.message),
  });

  const finishM = useMutation({
    mutationFn: async () => {
      if (draftEgo) {
        await upsertEgoFn({
          data: {
            nome: draftEgo.nome.trim(),
            codigo: draftEgo.codigo.map((c) => c.trim()).filter(Boolean).slice(0, 8),
            virtudes: draftEgo.virtudes.map((v) => v.trim()).filter(Boolean).slice(0, 6),
            inimigo: draftEgo.inimigo.trim(),
            resumo: draftEgo.resumo.trim(),
            source_answers: {
              virtude,
              inimigo,
              reconhecimento: reconhecimento.trim() || "homem que cumpre o que promete",
            },
          },
        });
      }
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
      markPendingProductTour();
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

  function proceedToIdentity() {
    if (metas.length === 0) return toast.error("Defina ao menos uma meta.");
    setStep(3);
  }

  function proceedToHabits() {
    if (!draftEgo) return toast.error("Crie sua identidade antes de continuar.");
    suggestM.mutate();
  }

  function skipHabits() {
    if (!draftEgo) return toast.error("Crie sua identidade antes de continuar.");
    finishM.mutate();
  }

  const stepTitle =
    step === 1
      ? "Onde você quer evoluir?"
      : step === 2
        ? "Suas primeiras metas"
        : step === 3
          ? "Sua próxima versão"
          : "Hábitos sugeridos";

  const stepHint =
    step === 1
      ? "Escolha 2 a 4 áreas de foco."
      : step === 2
        ? "Ajuste ou adicione o que fizer sentido."
        : step === 3
          ? "Quem você precisa se tornar para conquistar isso?"
          : suggestSource === "ai"
            ? "Charlie montou uma rotina. Revise antes de confirmar."
            : "Sugestões prontas — edite ou remova o que quiser.";

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-hero">Passo {step} de 4</p>
        <h1 className="mt-2 font-display text-3xl font-bold">{stepTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{stepHint}</p>
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
              onClick={proceedToIdentity}
              disabled={metas.length === 0}
              className="flex-1 rounded-none shadow-hero"
            >
              Continuar <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-transparent bg-card/90 p-6 space-y-5">
          {!draftEgo ? (
            <>
              <div className="space-y-2">
                <Label>Característica que mais precisa desenvolver</Label>
                <select
                  className="flex h-10 w-full border border-input bg-background px-3 text-sm"
                  value={virtude}
                  onChange={(e) => setVirtude(e.target.value)}
                >
                  {ALTER_EGO_VIRTUDES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>O que mais costuma impedir você</Label>
                <select
                  className="flex h-10 w-full border border-input bg-background px-3 text-sm"
                  value={inimigo}
                  onChange={(e) => setInimigo(e.target.value)}
                >
                  {ALTER_EGO_INIMIGOS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Como você gostaria de ser reconhecido?</Label>
                <Input
                  value={reconhecimento}
                  onChange={(e) => setReconhecimento(e.target.value)}
                  placeholder="Ex.: o homem que cumpre o que promete"
                  maxLength={120}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="rounded-none"
                  type="button"
                  onClick={() => setStep(2)}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1 rounded-none shadow-hero"
                  disabled={synthM.isPending}
                  onClick={() => synthM.mutate()}
                >
                  <Swords className="mr-2 h-4 w-4" />
                  {synthM.isPending ? "Sintetizando…" : "Criar identidade"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.28em] text-hero">
                  Alter Ego {egoSource === "ai" ? "· Charlie" : "· modelo"}
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold">{draftEgo.nome}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{draftEgo.resumo}</p>
              </div>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={draftEgo.nome}
                  onChange={(e) => setDraftEgo({ ...draftEgo, nome: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Código (uma regra por linha)</Label>
                <Textarea
                  className="rounded-none"
                  rows={5}
                  value={draftEgo.codigo.join("\n")}
                  onChange={(e) =>
                    setDraftEgo({
                      ...draftEgo,
                      codigo: e.target.value
                        .split("\n")
                        .map((l) => l.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Inimigo: <span className="text-foreground">{draftEgo.inimigo}</span>
                {" · "}
                Virtudes: {draftEgo.virtudes.join(", ")}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="rounded-none"
                  type="button"
                  onClick={() => setDraftEgo(null)}
                >
                  Refazer perguntas
                </Button>
                <Button
                  className="flex-1 rounded-none shadow-hero"
                  disabled={suggestM.isPending}
                  onClick={proceedToHabits}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {suggestM.isPending ? "Gerando hábitos…" : "Gerar hábitos com Charlie"}
                </Button>
              </div>
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={skipHabits}
                disabled={finishM.isPending}
              >
                Pular hábitos e ir à jornada
              </button>
            </>
          )}
        </Card>
      )}

      {step === 4 && (
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
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => setSuggestions(suggestions.filter((_, x) => x !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ATRIBUTO_LABELS[h.atributo] ?? h.atributo} · {h.categoria}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="rounded-none"
              type="button"
              onClick={() => setStep(3)}
            >
              Voltar
            </Button>
            <Button
              className="flex-1 rounded-none shadow-hero"
              disabled={finishM.isPending}
              onClick={() => finishM.mutate()}
            >
              {finishM.isPending ? "Abrindo jornada…" : "Começar jornada"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
