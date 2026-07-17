import { queryOptions } from "@tanstack/react-query";
import { getJourney, listGoals } from "@/lib/journey.functions";

export const JOURNEY_STALE_MS = 30_000;

export const journeyQueryOptions = () =>
  queryOptions({
    queryKey: ["journey"] as const,
    queryFn: () => getJourney({ data: undefined as unknown as never }),
    staleTime: JOURNEY_STALE_MS,
  });

export const goalsQueryOptions = () =>
  queryOptions({
    queryKey: ["goals"] as const,
    queryFn: () => listGoals({ data: undefined as unknown as never }),
    staleTime: JOURNEY_STALE_MS,
  });

export type JourneyData = Awaited<ReturnType<typeof getJourney>>;
