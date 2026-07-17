import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { setGoals } from "@/lib/journey.functions";
import { CATEGORIAS } from "@/lib/journey";
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

function Onboarding() {
  const navigate = useNavigate();
  const setFn = useServerFn(setGoals);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<1 | 2>(1);
  const [metas, setMetas] = useState<{ categoria: string; titulo: string }[]>([]);

  const m = useMutation({
    mutationFn: () => setFn({ data: { goals: metas as { categoria: "corpo"|"mente"|"espirito"|"prosperidade"|"relacionamentos"|"proposito"; titulo: string }[] } }),
    onSuccess: () => { toast.success("Sua jornada está pronta."); navigate({ to: "/journey", replace: true }); },
    onError: (e) => toast.error(e.message),
  });

  function toggleCat(id: string) {
    const n = new Set(selecionadas);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelecionadas(n);
  }

  function proceedToMetas() {
    if (selecionadas.size === 0) return toast.error("Escolha ao menos uma área.");
    const iniciais = [...selecionadas].flatMap((cat) =>
      (SUGESTOES[cat] ?? []).slice(0, 2).map((titulo) => ({ categoria: cat, titulo }))
    );
    setMetas(iniciais);
    setStep(2);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-hero">Passo {step} de 2</p>
        <h1 className="mt-2 font-display text-3xl font-bold">
          {step === 1 ? "Onde você quer evoluir?" : "Suas primeiras metas"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {step === 1 ? "Escolha 2 a 4 áreas de foco." : "Ajuste ou adicione o que fizer sentido."}
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
                <span className="text-lg">{CATEGORIAS.find((c) => c.id === meta.categoria)?.emoji}</span>
                <Input
                  value={meta.titulo}
                  onChange={(e) => {
                    const c = [...metas]; c[i] = { ...c[i], titulo: e.target.value }; setMetas(c);
                  }}
                />
                <Button variant="ghost" size="sm" onClick={() => setMetas(metas.filter((_, x) => x !== i))}>×</Button>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" className="rounded-none" onClick={() => setStep(1)}>Voltar</Button>
            <Button onClick={() => m.mutate()} disabled={m.isPending || metas.length === 0} className="flex-1 rounded-none">
              Iniciar minha jornada
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
