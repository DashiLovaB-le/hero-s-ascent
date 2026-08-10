import { computeHybridExerciseXp } from "@/lib/exercise-xp";
import {
  WORKOUT_XP_MAX,
  type WorkoutSetProgress,
  type WorkoutTemplateDef,
} from "@/lib/fitness/workout-templates";

type TypeXp = {
  slug: string;
  xp_base: number;
  xp_por_rep_valida: number;
  xp_sessao_max: number;
};

/** XP consolidado do treino: soma híbrida por série, com teto. */
export function computeWorkoutXp(
  template: WorkoutTemplateDef,
  progress: WorkoutSetProgress[],
  typesBySlug: Map<string, TypeXp>,
): { xp: number; perSet: Array<{ stepIndex: number; setIndex: number; xp: number }> } {
  const perSet: Array<{ stepIndex: number; setIndex: number; xp: number }> = [];
  let sum = 0;

  for (const p of progress) {
    const t = typesBySlug.get(p.exerciseSlug);
    if (!t) continue;
    // Hold: reps_validas = segundos; ainda usa fórmula híbrida
    const { xp } = computeHybridExerciseXp({
      xpBase: Math.round(t.xp_base / Math.max(1, template.steps[p.stepIndex]?.sets ?? 1)),
      xpPorRepValida: t.xp_por_rep_valida,
      xpSessaoMax: t.xp_sessao_max,
      repsValidas: Math.max(1, p.reps_validas),
      formaPct: p.forma_pct,
    });
    perSet.push({ stepIndex: p.stepIndex, setIndex: p.setIndex, xp });
    sum += xp;
  }

  const xp = Math.min(WORKOUT_XP_MAX, Math.max(progress.length > 0 ? 20 : 0, sum));
  return { xp, perSet };
}

export function workoutIsComplete(
  template: WorkoutTemplateDef,
  progress: WorkoutSetProgress[],
): boolean {
  const needed = template.steps.reduce((n, s) => n + s.sets, 0);
  return progress.length >= needed;
}

export function nextWorkoutCursor(
  template: WorkoutTemplateDef,
  progress: WorkoutSetProgress[],
): { stepIndex: number; setIndex: number } | null {
  if (workoutIsComplete(template, progress)) return null;
  const done = new Set(progress.map((p) => `${p.stepIndex}:${p.setIndex}`));
  for (let si = 0; si < template.steps.length; si++) {
    const step = template.steps[si]!;
    for (let set = 0; set < step.sets; set++) {
      if (!done.has(`${si}:${set}`)) return { stepIndex: si, setIndex: set };
    }
  }
  return null;
}
