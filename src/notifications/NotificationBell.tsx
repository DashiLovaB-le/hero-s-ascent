import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { isNativePlatform } from "@/lib/platform";
import {
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from "@/notifications/functions";
import {
  notificationsQueryOptions,
  unreadNotificationCountQueryOptions,
} from "@/notifications/queries";

type ListFilter = "all" | "unread";

function hrefFromMetadata(metadata: NotificationRow["metadata"]): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const href = (metadata as Record<string, unknown>).href;
  return typeof href === "string" && href.startsWith("/") ? href : null;
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<ListFilter>("all");
  const router = useRouter();
  const qc = useQueryClient();
  const markReadFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);

  const { data: unread = 0 } = useQuery({
    ...unreadNotificationCountQueryOptions(),
    throwOnError: false,
  });
  const { data: items = [], isLoading, isError } = useQuery({
    ...notificationsQueryOptions(filter, 30),
    enabled: open,
    throwOnError: false,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      try {
        return await markReadFn({ data: { id } });
      } catch (e) {
        throw e instanceof Error ? e : new Error(String(e ?? "Falha ao marcar notificação"));
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      try {
        return await markAllFn({ data: undefined as unknown as never });
      } catch (e) {
        throw e instanceof Error ? e : new Error(String(e ?? "Falha ao marcar notificações"));
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  async function onItemClick(n: NotificationRow) {
    if (!n.lido_em) {
      try {
        await markRead.mutateAsync(n.id);
      } catch {
        /* badge refreshes on next open */
      }
    }
    const href = hrefFromMetadata(n.metadata);
    setOpen(false);
    if (href) {
      router.history.push(href);
    }
  }

  const badge = unread > 99 ? "99+" : unread > 0 ? String(unread) : null;
  const native = isNativePlatform();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative"
          aria-label={badge ? `Notificações, ${badge} não lidas` : "Notificações"}
        >
          <Bell className="h-4 w-4" />
          {badge ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-hero px-1 text-[10px] font-bold leading-none text-background">
              {badge}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        data-native-notif-sheet={native ? "" : undefined}
        className={cn(
          "cp-panel flex w-full flex-col border border-transparent bg-card/95 p-0 sm:max-w-md",
          native && "native-notif-sheet",
        )}
      >
        <SheetHeader className="space-y-3 border-b border-border px-5 py-4 text-left">
          <div className={cn("flex items-center justify-between gap-2", native ? "pr-2" : "pr-8")}>
            <SheetTitle className="font-display text-base">Notificações</SheetTitle>
            <div className="flex shrink-0 items-center gap-1">
              {unread > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  disabled={markAll.isPending}
                  onClick={() => markAll.mutate()}
                >
                  Marcar todas
                </Button>
              ) : null}
              {native ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-foreground"
                  aria-label="Fechar notificações"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-5 w-5" strokeWidth={2.5} />
                </Button>
              ) : null}
            </div>
          </div>
          <SheetDescription className="text-xs">
            Avisos da jornada e do Charlie.
          </SheetDescription>
          <div className="flex gap-2" role="tablist" aria-label="Filtro de notificações">
            <FilterChip
              active={filter === "all"}
              label="Todas"
              onClick={() => setFilter("all")}
            />
            <FilterChip
              active={filter === "unread"}
              label="Não lidas"
              onClick={() => setFilter("unread")}
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {isLoading ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : isError ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              Não foi possível carregar. Confira se a migration de notificações foi aplicada.
            </p>
          ) : items.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              Nada por aqui, herói.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((n) => {
                const unreadItem = !n.lido_em;
                const markingThis = markRead.isPending && markRead.variables === n.id;
                return (
                  <li key={n.id}>
                    <div
                      className={cn(
                        "cp-panel flex w-full items-start gap-2 border border-transparent p-3 transition-[filter,background-color]",
                        unreadItem ? "bg-hero/10" : "bg-surface/60",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => void onItemClick(n)}
                        className="min-w-0 flex-1 text-left transition-[filter] hover:brightness-110"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-sm leading-snug",
                              unreadItem ? "font-semibold text-foreground" : "text-foreground/90",
                            )}
                          >
                            {n.titulo}
                          </p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatRelative(n.created_at)}
                          </span>
                        </div>
                        {n.corpo ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.corpo}</p>
                        ) : null}
                      </button>

                      {unreadItem ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-0.5 h-7 w-7 shrink-0 text-muted-foreground hover:bg-hero/15 hover:text-hero"
                          disabled={markingThis}
                          aria-label="Marcar como lida"
                          title="Marcar como lida"
                          onClick={(e) => {
                            e.stopPropagation();
                            markRead.mutate(n.id);
                          }}
                        >
                          <img
                            src="/icons/checked.png"
                            alt=""
                            aria-hidden
                            className="notif-check-unread h-3.5 w-3.5 object-contain"
                          />
                        </Button>
                      ) : (
                        <span
                          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center opacity-55"
                          title="Lida"
                          aria-label="Lida"
                        >
                          <img
                            src="/icons/checked.png"
                            alt=""
                            aria-hidden
                            className="h-3.5 w-3.5 object-contain"
                          />
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "px-3 py-1 text-xs transition-colors",
        active
          ? "bg-hero/20 text-hero"
          : "bg-surface/80 text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
