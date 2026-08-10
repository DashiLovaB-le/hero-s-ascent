import type { ExerciseCatalogItem, ExerciseDefinition } from "./definitions/types";
import { pushupDefinition } from "./definitions/pushup";
import { squatDefinition } from "./definitions/squat";
import { plankDefinition } from "./definitions/plank";
import { lungeDefinition } from "./definitions/lunge";
import { situpDefinition } from "./definitions/situp";
import { gluteBridgeDefinition } from "./definitions/glute-bridge";

const DEFINITIONS: ExerciseDefinition[] = [
  pushupDefinition,
  squatDefinition,
  plankDefinition,
  lungeDefinition,
  situpDefinition,
  gluteBridgeDefinition,
];

const BY_SLUG = new Map(DEFINITIONS.map((d) => [d.slug, d]));

export function getExerciseDefinition(slug: string): ExerciseDefinition | null {
  return BY_SLUG.get(slug) ?? null;
}

export function listExerciseDefinitions(): ExerciseDefinition[] {
  return [...DEFINITIONS];
}

/** Catálogo do hub (client) — available=true quando a def existe (seed DB à parte). */
export function listFitnessCatalog(): ExerciseCatalogItem[] {
  return DEFINITIONS.map((d) => ({
    slug: d.slug,
    nome: d.nome,
    shortBlurb: d.shortBlurb,
    region: d.region,
    mode: d.mode,
    available: true,
  }));
}

export const FITNESS_HUB_PATH = "/fitness" as const;
