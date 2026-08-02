import { queryOptions, infiniteQueryOptions } from "@tanstack/react-query";
import { getJourney, listGoals, listActivityHistory } from "@/lib/journey.functions";
import { getGoalsBoard } from "@/lib/goals.functions";
import { getProfilePanorama } from "@/lib/profile.functions";
import { listMissions } from "@/lib/missions.functions";
import { runQueryFn } from "@/lib/safe-query";

export const JOURNEY_STALE_MS = 30_000;
export const ACTIVITY_PAGE_SIZE = 15;

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

export const goalsBoardQueryOptions = () =>
  queryOptions({
    queryKey: ["goals-board"] as const,
    queryFn: () =>
      runQueryFn(
        () => getGoalsBoard({ data: undefined as unknown as never }),
        "Falha ao carregar o painel de metas.",
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

/** @deprecated prefer activityHistoryInfiniteQueryOptions */
export const activityHistoryQueryOptions = (limit = ACTIVITY_PAGE_SIZE) =>
  queryOptions({
    queryKey: ["activity-history", "page", limit] as const,
    queryFn: () =>
      runQueryFn(
        () => listActivityHistory({ data: { limit } }),
        "Falha ao carregar o histórico.",
      ),
    staleTime: JOURNEY_STALE_MS,
  });

export const activityHistoryInfiniteQueryOptions = () =>
  infiniteQueryOptions({
    queryKey: ["activity-history"] as const,
    queryFn: ({ pageParam }) =>
      runQueryFn(
        () =>
          listActivityHistory({
            data: {
              limit: ACTIVITY_PAGE_SIZE,
              ...(pageParam ? { cursor: pageParam } : {}),
            },
          }),
        "Falha ao carregar o histórico.",
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore && last.nextCursor ? last.nextCursor : undefined),
    staleTime: JOURNEY_STALE_MS,
  });

export const missionsQueryOptions = () =>
  queryOptions({
    queryKey: ["missions"] as const,
    queryFn: () =>
      runQueryFn(
        () => listMissions({ data: undefined as unknown as never }),
        "Falha ao carregar missões.",
      ),
    staleTime: JOURNEY_STALE_MS,
  });

export type JourneyData = Awaited<ReturnType<typeof getJourney>>;
export type ProfilePanoramaData = Awaited<ReturnType<typeof getProfilePanorama>>;
export type ActivityHistoryData = Awaited<ReturnType<typeof listActivityHistory>>;
export type MissionsData = Awaited<ReturnType<typeof listMissions>>;
