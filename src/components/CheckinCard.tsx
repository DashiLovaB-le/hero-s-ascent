import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Moon } from "lucide-react";
import { toast } from "sonner";

import { getTodayCheckin, upsertTodayCheckin } from "@/lib/checkins.functions";
import { Button } from "@/components/ui/button";

/** Check-in diário (sono / energia / humor) — ML Fase 4. */
export function CheckinCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getTodayCheckin);
  const saveFn = useServerFn(upsertTodayCheckin);

  const { data: today } = useQuery({
    queryKey: ["checkin-today"],
    queryFn: () => getFn({ data: undefined as unknown as never }),
  });

  const [sonoHoras, setSonoHoras] = useState<string>("");
  const [sonoQualidade, setSonoQualidade] = useState<number | null>(null);
  const [energia, setEnergia] = useState<number | null>(null);
  const [humor, setHumor] = useState<number | null>(null);

  const saved = Boolean(today);

  const saveM = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          sono_horas: sonoHoras.trim() ? Number(sonoHoras) : null,
          sono_qualidade: sonoQualidade,
          energia,
          humor,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["checkin-today"] });
      toast.success("Check-in registrado.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar"),
  });

  return (
    <section className="border border-border/80 bg-surface/50 px-4 py-4">
      <div className="flex items-center gap-2">
        <Moon className="h-4 w-4 text-hero" />
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-hero">Check-in do dia</p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Sono, energia e humor — o Charlie só usa o que você registrar.
      </p>

      {saved && today ? (
        <p className="mt-3 text-sm">
          Hoje:{" "}
          {[
            today.sono_horas != null ? `${today.sono_horas}h sono` : null,
            today.sono_qualidade != null ? `qualidade ${today.sono_qualidade}/5` : null,
            today.energia != null ? `energia ${today.energia}/5` : null,
            today.humor != null ? `humor ${today.humor}/5` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "registrado"}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="block text-xs text-muted-foreground">
            Horas de sono
            <input
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={sonoHoras}
              onChange={(e) => setSonoHoras(e.target.value)}
              className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <ScaleRow label="Qualidade do sono" value={sonoQualidade} onChange={setSonoQualidade} />
          <ScaleRow label="Energia" value={energia} onChange={setEnergia} />
          <ScaleRow label="Humor" value={humor} onChange={setHumor} />
          <Button
            type="button"
            size="sm"
            className="shadow-hero"
            disabled={saveM.isPending}
            onClick={() => saveM.mutate()}
          >
            Salvar check-in
          </Button>
        </div>
      )}
    </section>
  );
}

function ScaleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-8 w-8 text-sm ${
              value === n ? "bg-hero text-black" : "border border-border text-muted-foreground"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
