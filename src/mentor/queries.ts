import { queryOptions } from "@tanstack/react-query";
import { getMentorThread, listCompletedMentorChallenges } from "@/mentor/functions";
import { runQueryFn } from "@/lib/safe-query";

export const MENTOR_STALE_MS = 15_000;

export const mentorThreadQueryOptions = () =>
  queryOptions({
    queryKey: ["mentor-thread"] as const,
    queryFn: () =>
      runQueryFn(
        () => getMentorThread({ data: undefined as unknown as never }),
        "Falha ao carregar a conversa com o Charlie.",
      ),
    staleTime: MENTOR_STALE_MS,
  });

export const completedChallengesQueryOptions = () =>
  queryOptions({
    queryKey: ["mentor-challenges-completed"] as const,
    queryFn: () =>
      runQueryFn(
        () => listCompletedMentorChallenges({ data: undefined as unknown as never }),
        "Falha ao carregar desafios concluídos.",
      ),
    staleTime: MENTOR_STALE_MS,
  });

export type MentorThreadData = Awaited<ReturnType<typeof getMentorThread>>;
export type CompletedChallengesData = Awaited<ReturnType<typeof listCompletedMentorChallenges>>;
