import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { adminAiUsageOverview, adminUpsertAiRate } from "@/admin/catalog.functions";
import {
  AdminError,
  AdminLoading,
  AdminShell,
  AdminTable,
  Panel,
  StatCard,
  StatGrid,
  shortId,
} from "@/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runQueryFn } from "@/lib/safe-query";

export const Route = createFileRoute("/dashitecnology/tokens")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "tokens"],
      queryFn: () => runQueryFn(() => adminAiUsageOverview(), "Falha tokens."),
    }),
  pendingComponent: AdminLoading,
  errorComponent: ({ error }) => (
    <AdminError error={error instanceof Error ? error : new Error(String(error))} />
  ),
  component: TokensAdminPage,
});

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
}

function TokensAdminPage() {
  const qc = useQueryClient();
  const rateFn = useServerFn(adminUpsertAiRate);
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "tokens"],
    queryFn: () => runQueryFn(() => adminAiUsageOverview(), "Falha tokens."),
  });

  const [model, setModel] = useState("anthropic/claude-sonnet-4");
  const [inp, setInp] = useState("3");
  const [out, setOut] = useState("15");

  const saveRate = useMutation({
    mutationFn: () =>
      rateFn({
        data: {
          model: model.trim(),
          input_usd_per_1m: Number(inp) || 0,
          output_usd_per_1m: Number(out) || 0,
        },
      }),
    onSuccess: () => {
      toast.success("Tarifa salva");
      void qc.invalidateQueries({ queryKey: ["admin", "tokens"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const avgCostPerCall7 =
    data.last7d.calls > 0 ? data.last7d.cost / data.last7d.calls : 0;

  return (
    <AdminShell
      title="Tokens IA"
      subtitle="Uso real do Charlie (OpenRouter) + estimativa de custo para dimensionar investimento."
    >
      <StatGrid>
        <StatCard label="Calls 7d" value={data.last7d.calls} />
        <StatCard label="Tokens 7d" value={data.last7d.total.toLocaleString("pt-BR")} />
        <StatCard label="Custo est. 7d" value={money(data.last7d.cost)} />
        <StatCard
          label="Projeção / mês"
          value={money(data.projectedMonthUsd)}
          hint="(média diária dos últimos 7d) × 30"
        />
        <StatCard label="Calls 30d" value={data.last30d.calls} />
        <StatCard label="Custo est. 30d" value={money(data.last30d.cost)} />
        <StatCard label="Custo médio / call (7d)" value={money(avgCostPerCall7)} />
        <StatCard
          label="Prompt / completion 7d"
          value={`${data.last7d.prompt.toLocaleString("pt-BR")} / ${data.last7d.completion.toLocaleString("pt-BR")}`}
        />
      </StatGrid>

      {(data.errors.ev7 || data.errors.ev30) && (
        <p className="mt-3 text-sm text-amber-300">
          {data.errors.ev7 || data.errors.ev30}
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Tarifas (USD / 1M tokens)">
          <AdminTable headers={["Modelo", "Input", "Output", "Notas"]}>
            {data.rates.map((r) => (
              <tr key={r.model} className="text-white/75">
                <td className="px-2 py-1.5 text-xs">{r.model}</td>
                <td className="px-2 py-1.5">${Number(r.input_usd_per_1m)}</td>
                <td className="px-2 py-1.5">${Number(r.output_usd_per_1m)}</td>
                <td className="px-2 py-1.5 text-xs text-white/40">{r.notes ?? ""}</td>
              </tr>
            ))}
          </AdminTable>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="text-xs text-white/50">
              Modelo
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-56 border-white/10 bg-black/30"
              />
            </label>
            <label className="text-xs text-white/50">
              Input $/1M
              <Input
                value={inp}
                onChange={(e) => setInp(e.target.value)}
                className="mt-1 w-24 border-white/10 bg-black/30"
              />
            </label>
            <label className="text-xs text-white/50">
              Output $/1M
              <Input
                value={out}
                onChange={(e) => setOut(e.target.value)}
                className="mt-1 w-24 border-white/10 bg-black/30"
              />
            </label>
            <Button disabled={saveRate.isPending} onClick={() => saveRate.mutate()}>
              Salvar tarifa
            </Button>
          </div>
          <p className="mt-3 text-xs text-white/40">
            Ajuste as tarifas conforme a fatura OpenRouter. A projeção mensal ajuda a decidir budget
            de IA por usuário ativo.
          </p>
        </Panel>

        <Panel title="Como ler">
          <ul className="space-y-2 text-sm text-white/60">
            <li>
              Cada mensagem do Charlie grava prompt + completion tokens em{" "}
              <code className="text-[#FC6E20]">ai_usage_events</code>.
            </li>
            <li>
              Custo estimado = tokens × tarifas da tabela (não é a fatura oficial, é proxy operacional).
            </li>
            <li>
              Se ainda não houver calls, use o app (falar com o Charlie) e volte aqui — os números
              aparecem em tempo quase real.
            </li>
            <li>
              Regra prática:{" "}
              <strong className="text-white">custo mensal ≈ usuários ativos × calls/dia × custo/call × 30</strong>
              .
            </li>
          </ul>
        </Panel>
      </div>

      <Panel className="mt-4" title="Eventos recentes">
        <AdminTable headers={["Quando", "Source", "Modelo", "Tokens", "US$", "User"]}>
          {data.recent.map((e) => (
            <tr key={e.id} className="text-white/75">
              <td className="px-2 py-1.5 text-xs">{e.created_at.slice(0, 16)}</td>
              <td className="px-2 py-1.5 text-xs">{e.source}</td>
              <td className="max-w-[160px] truncate px-2 py-1.5 text-xs">{e.model}</td>
              <td className="px-2 py-1.5">{e.total_tokens}</td>
              <td className="px-2 py-1.5">{money(Number(e.estimated_cost_usd))}</td>
              <td className="px-2 py-1.5 text-xs">
                {e.user_id ? shortId(e.user_id) : "—"}
              </td>
            </tr>
          ))}
        </AdminTable>
        {data.recent.length === 0 ? (
          <p className="mt-2 text-sm text-white/40">Nenhum evento ainda.</p>
        ) : null}
      </Panel>
    </AdminShell>
  );
}
