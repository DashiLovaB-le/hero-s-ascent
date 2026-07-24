import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const NOTIF_COLS = "id, user_id, tipo, titulo, corpo, metadata, lido_em, created_at";

export type NotificationRow = {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  corpo: string;
  metadata: Json;
  lido_em: string | null;
  created_at: string;
};

/** Client-safe: só listagem / marcar lida (sem service role / jobs). */
export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        filter: z.enum(["all", "unread"]).default("all"),
        limit: z.number().int().min(1).max(50).default(30),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("notifications")
      .select(NOTIF_COLS)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.filter === "unread") {
      q = q.is("lido_em", null);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as NotificationRow[];
  });

export const getUnreadNotificationCount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("lido_em", null);
    if (error) throw new Error(error.message);
    return count ?? 0;
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("notifications")
      .update({ lido_em: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .is("lido_em", null)
      .select(NOTIF_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as NotificationRow | null;
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ lido_em: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("lido_em", null);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
