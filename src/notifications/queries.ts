import { queryOptions } from "@tanstack/react-query";
import {
  getUnreadNotificationCount,
  listNotifications,
} from "@/notifications/functions";
import { JOURNEY_STALE_MS } from "@/lib/journey-queries";
import { runQueryFn } from "@/lib/safe-query";

export const notificationsQueryOptions = (
  filter: "all" | "unread" = "all",
  limit = 30,
) =>
  queryOptions({
    queryKey: ["notifications", filter, limit] as const,
    queryFn: () =>
      runQueryFn(
        () => listNotifications({ data: { filter, limit } }),
        "Falha ao carregar notificações.",
      ),
    staleTime: JOURNEY_STALE_MS,
  });

export const unreadNotificationCountQueryOptions = () =>
  queryOptions({
    queryKey: ["notifications-unread-count"] as const,
    queryFn: () =>
      runQueryFn(
        () => getUnreadNotificationCount({ data: undefined as unknown as never }),
        "Falha ao contar notificações.",
      ),
    staleTime: JOURNEY_STALE_MS,
  });
