import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getRankingOptIn, updateRankingOptIn } from "@/lib/exercise-ranking.functions";
import { runQueryFn } from "@/lib/safe-query";

export function RankingSettingsCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getRankingOptIn);
  const updateFn = useServerFn(updateRankingOptIn);

  const { data, isLoading } = useQuery({
    queryKey: ["ranking-opt-in"],
    queryFn: () => runQueryFn(() => getFn(), "Falha ao carregar preferência de ranking."),
  });

  const optedIn = data?.optedIn ?? false;

  const save = useMutation({
    mutationFn: (next: boolean) => updateFn({ data: { optedIn: next } }),
    onSuccess: (res) => {
      qc.setQueryData(["ranking-opt-in"], { optedIn: res.optedIn });
      void qc.invalidateQueries({ queryKey: ["exercise-ranking"] });
      toast.success(res.optedIn ? "Você aparece no ranking." : "Você saiu do ranking público.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center bg-hero/15 text-hero">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold">Ranking de exercícios</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Aparecer no ranking semanal de flexões (só nome e reps — sem e-mail).
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-md border border-border/60 bg-surface/40 px-3 py-2.5">
        <Label htmlFor="ranking-opt-in" className="text-sm font-normal text-foreground">
          Aparecer no ranking
        </Label>
        <Switch
          id="ranking-opt-in"
          checked={optedIn}
          disabled={isLoading || save.isPending}
          onCheckedChange={(v) => save.mutate(v)}
        />
      </div>
    </div>
  );
}
