import { queryOptions } from "@tanstack/react-query";
import { getJourney, listGoals } from "@/lib/journey.functions";
import { getProfilePanorama } from "@/lib/profile.functions";
import { runQueryFn } from "@/lib/safe-query";

export const JOURNEY_STALE_MS = 30_000;

export const journeyQueryOptions = () =>
  queryOptions({
    queryKey: ["journey"] as const,
    queryFn: () =>
      runQueryFn(
        () => getJourney({ data: undefined as unknown as never }),
        "Falha ao carregar a jornada.",
      ),
    staleTime: JOURNEY_STALE_MS,
  });

export const goalsQueryOptions = () =>
  queryOptions({
    queryKey: ["goals"] as const,
    queryFn: () =>
      runQueryFn(
        () => listGoals({ data: undefined as unknown as never }),
        "Falha ao carregar as metas.",
      ),
    staleTime: JOURNEY_STALE_MS,
  });

export const profilePanoramaQueryOptions = () =>
  queryOptions({
    queryKey: ["profile-panorama"] as const,
    queryFn: () =>
      runQueryFn(
        () => getProfilePanorama({ data: undefined as unknown as never }),
        "Falha ao carregar o perfil.",
      ),
    staleTime: JOURNEY_STALE_MS,
  });

export type JourneyData = Awaited<ReturnType<typeof getJourney>>;
export type ProfilePanoramaData = Awaited<ReturnType<typeof getProfilePanorama>>;
