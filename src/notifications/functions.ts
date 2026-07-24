import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createNotification, NOTIFICATION_TIPOS, type NotificationTipo } from "@/notifications/create";
import { runProductNotificationJobs } from "@/notifications/jobs";

export { createNotification, NOTIFICATION_TIPOS, type NotificationTipo };

const NOTIF_COLS = "id, user_id, tipo, titulo, corpo, metadata, lido_em, created_at";

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
    return rows ?? [];
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
    return row;
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

/**
 * Job diário (Fase 2). Protegido por CRON_SECRET (não usa sessão de usuário).
 * Ex.: POST com `{ "data": { "secret": "...", "force": false } }`
 */
export const runNotificationJobs = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        secret: z.string().min(1),
        force: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const expected = process.env.CRON_SECRET;
    if (!expected || data.secret !== expected) {
      throw new Error("Unauthorized");
    }
    return runProductNotificationJobs({ force: data.force });
  });

export type NotificationRow = Awaited<ReturnType<typeof listNotifications>>[number];
