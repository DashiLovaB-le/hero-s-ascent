import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertIsAdmin } from "@/admin/auth";

const alarmSchema = z.object({
  enabled: z.boolean(),
  time_local: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  days_of_week: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  timezone: z.string().min(1).max(64).optional(),
  snooze_minutes: z.number().int().min(1).max(30).optional(),
  audio_key: z.string().min(1).max(40).optional(),
  reason_text: z.string().min(1).max(80).optional(),
});

export type CharlieAlarmRow = {
  id: string;
  user_id: string;
  enabled: boolean;
  time_local: string;
  days_of_week: number[];
  timezone: string;
  snooze_minutes: number;
  audio_key: string;
  reason_text: string;
  updated_at: string;
};

function normalizeTime(t: string): string {
  const parts = t.split(":");
  return `${parts[0]?.padStart(2, "0") ?? "06"}:${parts[1]?.padStart(2, "0") ?? "30"}`;
}

async function readGlobalEnabled(): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "charlie_alarm_enabled")
    .maybeSingle();
  const v = (data?.value ?? "true").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

export const getCharlieAlarm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ alarm: CharlieAlarmRow | null; globalEnabled: boolean }> => {
    const { userId, supabase } = context;
    const globalEnabled = await readGlobalEnabled();
    const { data, error } = await supabase
      .from("charlie_alarms")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      if (/charlie_alarms|schema cache|does not exist/i.test(error.message)) {
        return { alarm: null, globalEnabled };
      }
      throw new Error(error.message);
    }
    if (!data) return { alarm: null, globalEnabled };
    const row = data as CharlieAlarmRow;
    return {
      globalEnabled,
      alarm: {
        ...row,
        time_local: normalizeTime(String(row.time_local)),
        days_of_week: (row.days_of_week ?? []) as number[],
      },
    };
  });

export const upsertCharlieAlarm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(alarmSchema)
  .handler(async ({ data, context }): Promise<CharlieAlarmRow> => {
    const { userId, supabase } = context;
    const globalEnabled = await readGlobalEnabled();
    if (!globalEnabled && data.enabled) {
      throw new Error("Despertador Charlie está desligado globalmente pelo Dashi.");
    }

    const time = normalizeTime(data.time_local);
    const payload = {
      user_id: userId,
      enabled: data.enabled,
      time_local: time.length === 5 ? `${time}:00` : time,
      days_of_week: data.days_of_week,
      timezone:
        data.timezone ??
        (typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : "America/Sao_Paulo"),
      snooze_minutes: data.snooze_minutes ?? 5,
      audio_key: data.audio_key ?? "classico",
      reason_text: data.reason_text ?? "Hora de subir",
      updated_at: new Date().toISOString(),
    };

    const { data: row, error } = await supabase
      .from("charlie_alarms")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    const r = row as CharlieAlarmRow;
    return { ...r, time_local: normalizeTime(String(r.time_local)) };
  });

export const logCharlieAlarmEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      outcome: z.enum(["answered", "dismissed", "snoozed", "missed", "simulated"]),
      platform: z.string().default("android"),
      call_id: z.string().optional(),
      meta: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { error } = await supabase.from("charlie_alarm_events").insert({
      user_id: userId,
      outcome: data.outcome,
      platform: data.platform,
      call_id: data.call_id ?? null,
      meta: data.meta ?? {},
    });
    if (error && !/charlie_alarm_events|schema cache|does not exist/i.test(error.message)) {
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminGetCharlieAlarmConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertIsAdmin(context.userId);

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("key, value, updated_at")
      .in("key", [
        "charlie_alarm_enabled",
        "charlie_alarm_default_reason",
        "charlie_alarm_default_audio_key",
      ]);

    const map = new Map((settings ?? []).map((s) => [s.key, s]));
    const { count } = await supabaseAdmin
      .from("charlie_alarms")
      .select("id", { count: "exact", head: true })
      .eq("enabled", true);

    const { data: recent } = await supabaseAdmin
      .from("charlie_alarm_events")
      .select("id, user_id, outcome, fired_at, platform, call_id")
      .order("fired_at", { ascending: false })
      .limit(30);

    return {
      enabled: (map.get("charlie_alarm_enabled")?.value ?? "true").toLowerCase() !== "false",
      defaultReason: map.get("charlie_alarm_default_reason")?.value ?? "Hora de subir",
      defaultAudioKey: map.get("charlie_alarm_default_audio_key")?.value ?? "classico",
      enabledUsers: count ?? 0,
      recent: recent ?? [],
    };
  });

export const adminSetCharlieAlarmConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      enabled: z.boolean(),
      defaultReason: z.string().min(1).max(80),
      defaultAudioKey: z.string().min(1).max(40),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertIsAdmin(context.userId);
    const now = new Date().toISOString();
    const rows = [
      {
        key: "charlie_alarm_enabled",
        value: data.enabled ? "true" : "false",
        updated_at: now,
        updated_by: context.userId,
      },
      {
        key: "charlie_alarm_default_reason",
        value: data.defaultReason,
        updated_at: now,
        updated_by: context.userId,
      },
      {
        key: "charlie_alarm_default_audio_key",
        value: data.defaultAudioKey,
        updated_at: now,
        updated_by: context.userId,
      },
    ];
    const { error } = await supabaseAdmin.from("app_settings").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
