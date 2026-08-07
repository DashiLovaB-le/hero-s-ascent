import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  adminHeroesGrowth,
  type HeroesGrowthRange,
} from "@/admin/functions";
import { Panel } from "@/admin/ui";
import { runQueryFn } from "@/lib/safe-query";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS: { id: HeroesGrowthRange; label: string }[] = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "all", label: "Tudo" },
];

export function AdminHeroesGrowthChart() {
  const [range, setRange] = useState<HeroesGrowthRange>("30d");
  const [onboardedOnly, setOnboardedOnly] = useState(false);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["admin", "users", "growth", range, onboardedOnly],
    queryFn: () =>
      runQueryFn(
        () => adminHeroesGrowth({ data: { range, onboardedOnly } }),
        "Falha ao carregar evolução de heróis.",
      ),
    staleTime: 60_000,
  });

  return (
    <Panel className="mb-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.24em] text-[#FC6E20]">
            Evolução
          </p>
          <h2 className="mt-1 font-display text-lg tracking-wide text-white">
            Heróis cadastrados ao longo do tempo
          </h2>
          <p className="mt-1 text-xs text-white/45">
            Novos por dia e total acumulado (fuso Brasília).
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  range === opt.id
                    ? "bg-[#FC6E20] text-black"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-white/55">
            <input
              type="checkbox"
              checked={onboardedOnly}
              onChange={(e) => setOnboardedOnly(e.target.checked)}
              className="size-3.5 accent-[#FC6E20]"
            />
            Só onboarding completo
          </label>
        </div>
      </div>

      {data ? (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Total</p>
            <p className="font-display text-xl text-white">{data.totalHeroes}</p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Novos no período</p>
            <p className="font-display text-xl text-[#FC6E20]">{data.newInPeriod}</p>
          </div>
          <div className="col-span-2 rounded-md border border-white/10 bg-black/30 px-3 py-2 sm:col-span-1">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Janela</p>
            <p className="text-sm text-white/70">
              {data.from === data.to ? data.from : `${data.from} → ${data.to}`}
            </p>
          </div>
        </div>
      ) : null}

      <div className="relative h-[240px] w-full sm:h-[280px]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-white/40">
            Carregando série…
          </div>
        ) : isError ? (
          <div className="flex h-full items-center justify-center text-sm text-red-400">
            {error instanceof Error ? error.message : "Erro ao carregar gráfico."}
          </div>
        ) : !data?.points.length ? (
          <div className="flex h-full items-center justify-center text-sm text-white/40">
            Ainda não há cadastros neste filtro.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart data={data.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="heroesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FC6E20" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#FC6E20" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,231,208,0.08)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,231,208,0.45)", fontSize: 10 }}
                axisLine={{ stroke: "rgba(255,231,208,0.15)" }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                yAxisId="cum"
                tick={{ fill: "rgba(255,231,208,0.45)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={36}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="new"
                orientation="right"
                tick={{ fill: "rgba(255,231,208,0.35)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={28}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#141414",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#FFE7D0" }}
                itemStyle={{ color: "#FFE7D0" }}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { date?: string } | undefined;
                  return row?.date ?? "";
                }}
              />
              <Area
                yAxisId="cum"
                type="monotone"
                dataKey="acumulado"
                name="Acumulado"
                stroke="#FC6E20"
                strokeWidth={2}
                fill="url(#heroesFill)"
                isAnimationActive={false}
              />
              <Line
                yAxisId="new"
                type="monotone"
                dataKey="novos"
                name="Novos no dia"
                stroke="#FFE7D0"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
        {isFetching && !isLoading ? (
          <p className="pointer-events-none absolute right-2 top-0 text-[10px] text-white/30">
            atualizando…
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-white/45">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-[#FC6E20]" /> Acumulado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-[#FFE7D0]" /> Novos no dia
        </span>
      </div>
    </Panel>
  );
}
