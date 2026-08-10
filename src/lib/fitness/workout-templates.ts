/** Templates de treino (fonte canônica no client; espelhados no DB na migration). */

export type WorkoutStepDef = {
  exerciseSlug: string;
  sets: number;
  /** Reps alvo por série (modo reps) */
  targetReps?: number;
  /** Segundos alvo por série (modo hold) */
  targetHoldSec?: number;
  /** Descanso após cada série (exceto a última do step, se restAfterStepMs) */
  restMs: number;
};

export type WorkoutTemplateDef = {
  slug: string;
  titulo: string;
  descricao: string;
  difficulty: "facil" | "medio";
  /** Minutos estimados (UI) */
  durationMin: number;
  region: "full" | "legs" | "push_core";
  steps: WorkoutStepDef[];
};

export const WORKOUT_XP_MAX = 200;
export const WORKOUTS_PER_DAY_MAX = 3;

export const WORKOUT_TEMPLATES: WorkoutTemplateDef[] = [
  {
    slug: "full-body-12",
    titulo: "Corpo inteiro · 12 min",
    descricao: "Agachamento, flexão, afundo, prancha e elevação de quadril.",
    difficulty: "medio",
    durationMin: 12,
    region: "full",
    steps: [
      { exerciseSlug: "squat", sets: 3, targetReps: 12, restMs: 40_000 },
      { exerciseSlug: "pushup", sets: 3, targetReps: 8, restMs: 40_000 },
      { exerciseSlug: "lunge", sets: 2, targetReps: 10, restMs: 35_000 },
      { exerciseSlug: "plank", sets: 1, targetHoldSec: 30, restMs: 30_000 },
      { exerciseSlug: "glute_bridge", sets: 3, targetReps: 12, restMs: 0 },
    ],
  },
  {
    slug: "legs-focus",
    titulo: "Pernas",
    descricao: "Agachamento, afundo e elevação de quadril.",
    difficulty: "medio",
    durationMin: 10,
    region: "legs",
    steps: [
      { exerciseSlug: "squat", sets: 3, targetReps: 12, restMs: 45_000 },
      { exerciseSlug: "lunge", sets: 3, targetReps: 10, restMs: 40_000 },
      { exerciseSlug: "glute_bridge", sets: 3, targetReps: 12, restMs: 0 },
    ],
  },
  {
    slug: "push-core",
    titulo: "Push + core",
    descricao: "Flexão, abdominal e prancha.",
    difficulty: "facil",
    durationMin: 8,
    region: "push_core",
    steps: [
      { exerciseSlug: "pushup", sets: 3, targetReps: 8, restMs: 40_000 },
      { exerciseSlug: "situp", sets: 3, targetReps: 12, restMs: 35_000 },
      { exerciseSlug: "plank", sets: 2, targetHoldSec: 25, restMs: 30_000 },
    ],
  },
];

export function getWorkoutTemplateDef(slug: string): WorkoutTemplateDef | null {
  return WORKOUT_TEMPLATES.find((t) => t.slug === slug) ?? null;
}

export function listWorkoutTemplateDefs(): WorkoutTemplateDef[] {
  return [...WORKOUT_TEMPLATES];
}

export function formatStepTarget(step: WorkoutStepDef): string {
  if (step.targetHoldSec != null) {
    return `${step.sets} × ${step.targetHoldSec}s`;
  }
  return `${step.sets} × ${step.targetReps ?? 10}`;
}

export type WorkoutSetProgress = {
  stepIndex: number;
  setIndex: number;
  exerciseSlug: string;
  reps_validas: number;
  reps_invalidas: number;
  forma_pct: number;
  amplitude_media: number;
  duracao_ms: number;
  completedAt: string;
};
