import { queryOptions } from "@tanstack/react-query";
import {
  getUnreadNotificationCount,
  listNotifications,
} from "@/notifications/functions";
import { JOURNEY_STALE_MS } from "@/lib/journey-queries";

export const notificationsQueryOptions = (
  filter: "all" | "unread" = "all",
  limit = 30,
) =>
  queryOptions({
    queryKey: ["notifications", filter, limit] as const,
    queryFn: () => listNotifications({ data: { filter, limit } }),
    staleTime: JOURNEY_STALE_MS,
  });

export const unreadNotificationCountQueryOptions = () =>
  queryOptions({
    queryKey: ["notifications-unread-count"] as const,
    queryFn: () => getUnreadNotificationCount({ data: undefined as unknown as never }),
    staleTime: JOURNEY_STALE_MS,
  });
