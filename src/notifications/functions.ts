import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const NOTIFICATION_TIPOS = [
  "mentor_challenge",
  "mentor_challenge_done",
  "habit_complete",
  "system",
] as const;

export type NotificationTipo = (typeof NOTIFICATION_TIPOS)[number];

const NOTIF_COLS = "id, user_id, tipo, titulo, corpo, metadata, lido_em, created_at";

/** Cria notificação (service role — bypass RLS de INSERT). */
export async function createNotification(input: {
  userId: string;
  tipo: NotificationTipo;
  titulo: string;
  corpo?: string;
  metadata?: Record<string, Json | undefined>;
}) {
  const { error } = await supabaseAdmin.from("notifications").insert({
    user_id: input.userId,
    tipo: input.tipo,
    titulo: input.titulo,
    corpo: input.corpo ?? "",
    metadata: (input.metadata ?? {}) as Json,
  });
  if (error) {
    console.error("[notifications] create", error.message);
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}

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

export type NotificationRow = Awaited<ReturnType<typeof listNotifications>>[number];
