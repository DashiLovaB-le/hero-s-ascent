import { queryOptions } from "@tanstack/react-query";
import { getMentorThread } from "@/mentor/functions";

export const MENTOR_STALE_MS = 15_000;

export const mentorThreadQueryOptions = () =>
  queryOptions({
    queryKey: ["mentor-thread"] as const,
    queryFn: () => getMentorThread({ data: undefined as unknown as never }),
    staleTime: MENTOR_STALE_MS,
  });

export type MentorThreadData = Awaited<ReturnType<typeof getMentorThread>>;
