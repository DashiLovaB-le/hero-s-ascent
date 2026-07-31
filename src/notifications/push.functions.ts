import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzeVapidPublicKey, getVapidPublicKey } from "@/notifications/push-config";

const settingsSchema = z.object({
  push_enabled: z.boolean().optional(),
  notify_habit_reminder: z.boolean().optional(),
  notify_streak_risk: z.boolean().optional(),
  notify_mentor: z.boolean().optional(),
  notify_achievement: z.boolean().optional(),
  notify_agent: z.boolean().optional(),
});

const DEFAULT_SETTINGS = {
  push_enabled: false,
  notify_habit_reminder: true,
  notify_streak_risk: true,
  notify_mentor: true,
  notify_achievement: true,
  notify_agent: true,
};

const SETTINGS_COLS =
  "user_id, push_enabled, notify_habit_reminder, notify_streak_risk, notify_mentor, notify_achievement, notify_agent";

export const getVapidPublicKeyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const key = getVapidPublicKey();
    const info = analyzeVapidPublicKey(key);
    return {
      publicKey: info.publicKey,
      valid: info.valid,
      keyLength: info.keyLength,
      byteLength: info.byteLength,
    };
  });

export const getNotificationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notification_settings")
      .select(SETTINGS_COLS)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { count, error: cErr } = await context.supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);
    if (cErr) throw new Error(cErr.message);

    return {
      settings: data ?? { user_id: context.userId, ...DEFAULT_SETTINGS },
      subscriptionCount: count ?? 0,
      vapidConfigured: Boolean(getVapidPublicKey()),
      vapid: analyzeVapidPublicKey(getVapidPublicKey()),
    };
  });

export const upsertNotificationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { data: existing, error: readErr } = await context.supabase
      .from("notification_settings")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);

    if (!existing) {
      const { data: row, error } = await context.supabase
        .from("notification_settings")
        .insert({ user_id: context.userId, ...DEFAULT_SETTINGS, ...data })
        .select(SETTINGS_COLS)
        .single();
      if (error) throw new Error(error.message);
      return { ok: true as const, settings: row };
    }

    const { data: row, error } = await context.supabase
      .from("notification_settings")
      .update(data)
      .eq("user_id", context.userId)
      .select(SETTINGS_COLS)
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, settings: row };
  });

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        endpoint: z.string().url().max(2048),
        p256dh: z.string().min(20).max(512),
        auth: z.string().min(8).max(256),
        userAgent: z.string().max(512).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);

    const { data: existing, error: readErr } = await context.supabase
      .from("notification_settings")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);

    if (!existing) {
      const { error: sErr } = await context.supabase.from("notification_settings").insert({
        user_id: context.userId,
        ...DEFAULT_SETTINGS,
        push_enabled: true,
      });
      if (sErr) throw new Error(sErr.message);
    } else {
      const { error: sErr } = await context.supabase
        .from("notification_settings")
        .update({ push_enabled: true })
        .eq("user_id", context.userId);
      if (sErr) throw new Error(sErr.message);
    }

    return { ok: true as const };
  });

export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        endpoint: z.string().url().max(2048).optional(),
        all: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    if (data.all) {
      const { error } = await context.supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    } else if (data.endpoint) {
      const { error } = await context.supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", context.userId)
        .eq("endpoint", data.endpoint);
      if (error) throw new Error(error.message);
    } else {
      throw new Error("Informe endpoint ou all.");
    }

    const { count } = await context.supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);

    if ((count ?? 0) === 0) {
      await context.supabase
        .from("notification_settings")
        .update({ push_enabled: false })
        .eq("user_id", context.userId);
    }

    return { ok: true as const, remaining: count ?? 0 };
  });
