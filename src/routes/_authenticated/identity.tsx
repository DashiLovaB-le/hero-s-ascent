import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Save, Sparkles, Swords } from "lucide-react";
import { toast } from "sonner";

import {
  getHeroAlterEgo,
  listHeroIdentityProofs,
  regenerateHeroAlterEgo,
  upsertHeroAlterEgo,
} from "@/lib/alter-ego.functions";
import {
  ALTER_EGO_INIMIGOS,
  ALTER_EGO_VIRTUDES,
  type HeroAlterEgo,
} from "@/lib/alter-ego";
import { identityArcForChapter } from "@/lib/identity-proofs";
import { runQueryFn } from "@/lib/safe-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/identity")({
  component: IdentityPage,
});

function IdentityPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getHeroAlterEgo);
  const upsertFn = useServerFn(upsertHeroAlterEgo);
  const regenFn = useServerFn(regenerateHeroAlterEgo);
  const proofsFn = useServerFn(listHeroIdentityProofs);

  const { data: alterEgo, isLoading } = useQuery({
    queryKey: ["hero-alter-ego"] as const,
    queryFn: () =>
      runQueryFn(() => getFn() as Promise<HeroAlterEgo | null>, "Falha ao carregar a identidade."),
  });

  const { data: proofsData } = useQuery({
    queryKey: ["identity-proofs"] as const,
    queryFn: () =>
      runQueryFn(
        () =>
          proofsFn() as Promise<{
            proofs: Array<{
              id: string;
              label: string;
              dia: string;
              source_type: string;
              created_at: string;
            }>;
            stats: { week: number; total: number };
          }>,
        "Falha ao carregar provas.",
      ),
    enabled: Boolean(alterEgo),
  });

  const [nome, setNome] = useState("");
  const [codigoText, setCodigoText] = useState("");
  const [virtudesText, setVirtudesText] = useState("");
  const [inimigo, setInimigo] = useState("");
  const [resumo, setResumo] = useState("");
  const [virtude, setVirtude] = useState<string>(ALTER_EGO_VIRTUDES[0]);
  const [inimigoPick, setInimigoPick] = useState<string>(ALTER_EGO_INIMIGOS[0]);
  const [reconhecimento, setReconhecimento] = useState("");

  useEffect(() => {
    if (!alterEgo) return;
    setNome(alterEgo.nome);
    setCodigoText(alterEgo.codigo.join("\n"));
    setVirtudesText(alterEgo.virtudes.join(", "));
    setInimigo(alterEgo.inimigo);
    setResumo(alterEgo.resumo);
    const answers = alterEgo.source_answers;
    if (answers.virtude) setVirtude(answers.virtude);
    if (answers.inimigo) setInimigoPick(answers.inimigo);
    if (answers.reconhecimento) setReconhecimento(answers.reconhecimento);
  }, [alterEgo]);

  const saveM = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          nome: nome.trim(),
          codigo: codigoText
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 8),
          virtudes: virtudesText
            .split(/[,;]/)
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 6),
          inimigo: inimigo.trim(),
          resumo: resumo.trim(),
        },
      }),
    onSuccess: async () => {
      toast.success("Identidade salva.");
      await qc.invalidateQueries({ queryKey: ["hero-alter-ego"] });
      await qc.invalidateQueries({ queryKey: ["journey"] });
      await qc.invalidateQueries({ queryKey: ["identity-proofs"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const createM = useMutation({
    mutationFn: () =>
      regenFn({
        data: {
          answers: {
            virtude,
            inimigo: inimigoPick,
            reconhecimento: reconhecimento.trim() || "homem que cumpre o que promete",
          },
        },
      }),
    onSuccess: async (res) => {
      toast.success(
        res.source === "ai"
          ? "Charlie sintetizou sua identidade."
          : "Identidade criada (modelo padrão).",
      );
      await qc.invalidateQueries({ queryKey: ["hero-alter-ego"] });
      await qc.invalidateQueries({ queryKey: ["journey"] });
      await qc.invalidateQueries({ queryKey: ["identity-proofs"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const regenM = useMutation({
    mutationFn: () => regenFn({ data: {} }),
    onSuccess: async (res) => {
      toast.success(
        res.source === "ai" ? "Identidade regenerada." : "Regenerada com modelo padrão.",
      );
      await qc.invalidateQueries({ queryKey: ["hero-alter-ego"] });
      await qc.invalidateQueries({ queryKey: ["journey"] });
      await qc.invalidateQueries({ queryKey: ["identity-proofs"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 animate-pulse py-6">
        <div className="h-10 bg-surface" />
        <div className="h-64 bg-surface" />
      </div>
    );
  }

  if (!alterEgo) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-6">
        <Link
          to="/journey"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar à jornada
        </Link>

        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-hero">Identidade</p>
          <h1 className="mt-2 font-display text-3xl font-bold">Sua próxima versão</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você sabe o que quer conquistar. Agora defina quem precisa se tornar.
          </p>
        </div>

        <Card className="border-transparent bg-card/90 p-6 space-y-5">
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
              value={inimigoPick}
              onChange={(e) => setInimigoPick(e.target.value)}
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
          <Button
            className="lp-btn w-full rounded-none shadow-hero"
            disabled={createM.isPending}
            onClick={() => createM.mutate()}
          >
            <img
              src="/favicon-antigo2.ico"
              alt=""
              aria-hidden
              className="mr-2 h-4 w-4 object-contain"
            />
            {createM.isPending ? "Sintetizando…" : "Criar com Charlie"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Isso não é a personalidade do Charlie na loja — é a sua identidade na jornada.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <Link
        to="/journey"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar à jornada
      </Link>

      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-hero">Identidade</p>
        <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-bold">
          <Swords className="h-7 w-7 text-hero" aria-hidden />
          {alterEgo.nome}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Charlie protege este código. Ajuste quando precisar — regenerar tem limite de tempo.
        </p>
      </div>

      <Card className="border-transparent bg-card/90 p-6 space-y-4">
        <div className="space-y-2">
          <Label>Nome do alter ego</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} />
        </div>
        <div className="space-y-2">
          <Label>Código (uma regra por linha)</Label>
          <Textarea
            value={codigoText}
            onChange={(e) => setCodigoText(e.target.value)}
            rows={5}
            className="rounded-none"
          />
        </div>
        <div className="space-y-2">
          <Label>Virtudes (separadas por vírgula)</Label>
          <Input value={virtudesText} onChange={(e) => setVirtudesText(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Inimigo principal</Label>
          <Input value={inimigo} onChange={(e) => setInimigo(e.target.value)} maxLength={40} />
        </div>
        <div className="space-y-2">
          <Label>Resumo</Label>
          <Textarea
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
            rows={2}
            className="rounded-none"
            maxLength={280}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1 rounded-none shadow-hero"
            disabled={saveM.isPending}
            onClick={() => saveM.mutate()}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveM.isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button
            variant="outline"
            className="rounded-none"
            disabled={regenM.isPending}
            onClick={() => regenM.mutate()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {regenM.isPending ? "Regenerando…" : "Regenerar"}
          </Button>
        </div>
      </Card>

      <Card className="border-transparent bg-card/90 p-6 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Provas</h2>
          <p className="text-xs text-muted-foreground">
            {proofsData?.stats.week ?? 0} esta semana · {proofsData?.stats.total ?? 0} total
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Arco: {identityArcForChapter(1).nome}…{identityArcForChapter(7).nome} — o capítulo da
          jornada define o estágio narrativo (sem %).
        </p>
        {(proofsData?.proofs?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda sem provas. Cumprir hábitos, metas e desafios gera evidência da identidade.
          </p>
        ) : (
          <ul className="space-y-2">
            {proofsData!.proofs.slice(0, 15).map((p) => (
              <li
                key={p.id}
                className="border-l-2 border-hero/60 pl-3 text-sm text-muted-foreground"
              >
                <span className="text-foreground">{p.label}</span>
                <span className="mt-0.5 block text-xs">
                  {p.dia} · {p.source_type}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Personalidade do Charlie (tom) fica em{" "}
        <Link to="/store" className="text-hero underline-offset-2 hover:underline">
          /store
        </Link>
        . Identidade do herói é outra coisa.
      </p>
    </div>
  );
}
