import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WORKOUT_TEMPLATES,
  type WorkoutSetProgress,
} from "@/lib/fitness/workout-templates";
import {
  computeWorkoutXp,
  nextWorkoutCursor,
  workoutIsComplete,
} from "@/lib/fitness/workout-xp";

const full = WORKOUT_TEMPLATES.find((t) => t.slug === "full-body-12")!;

function fakeSet(
  stepIndex: number,
  setIndex: number,
  slug: string,
): WorkoutSetProgress {
  return {
    stepIndex,
    setIndex,
    exerciseSlug: slug,
    reps_validas: 10,
    reps_invalidas: 0,
    forma_pct: 90,
    amplitude_media: 80,
    duracao_ms: 30_000,
    completedAt: new Date().toISOString(),
  };
}

describe("workout-xp", () => {
  it("nextWorkoutCursor avança step/set", () => {
    assert.deepEqual(nextWorkoutCursor(full, []), { stepIndex: 0, setIndex: 0 });
    const one = [fakeSet(0, 0, "squat")];
    assert.deepEqual(nextWorkoutCursor(full, one), { stepIndex: 0, setIndex: 1 });
  });

  it("workoutIsComplete após todas as séries", () => {
    const progress: WorkoutSetProgress[] = [];
    for (let si = 0; si < full.steps.length; si++) {
      const step = full.steps[si]!;
      for (let set = 0; set < step.sets; set++) {
        progress.push(fakeSet(si, set, step.exerciseSlug));
      }
    }
    assert.equal(workoutIsComplete(full, progress), true);
    assert.equal(nextWorkoutCursor(full, progress), null);
  });

  it("computeWorkoutXp aplica teto", () => {
    const types = new Map([
      ["squat", { slug: "squat", xp_base: 15, xp_por_rep_valida: 2, xp_sessao_max: 120 }],
      ["pushup", { slug: "pushup", xp_base: 15, xp_por_rep_valida: 2, xp_sessao_max: 120 }],
      ["lunge", { slug: "lunge", xp_base: 15, xp_por_rep_valida: 2, xp_sessao_max: 120 }],
      ["plank", { slug: "plank", xp_base: 10, xp_por_rep_valida: 1, xp_sessao_max: 90 }],
      [
        "glute_bridge",
        { slug: "glute_bridge", xp_base: 12, xp_por_rep_valida: 2, xp_sessao_max: 100 },
      ],
    ]);
    const progress: WorkoutSetProgress[] = [];
    for (let si = 0; si < full.steps.length; si++) {
      const step = full.steps[si]!;
      for (let set = 0; set < step.sets; set++) {
        progress.push({
          ...fakeSet(si, set, step.exerciseSlug),
          reps_validas: 50,
          forma_pct: 100,
        });
      }
    }
    const { xp } = computeWorkoutXp(full, progress, types);
    assert.equal(xp, 200);
  });
});
