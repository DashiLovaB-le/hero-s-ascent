import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertIsAdmin } from "@/admin/auth";

const TRACK_SKIP =
  /^\/dashitecnology(?:\/|$)|^\/maintenance$|^\/api(?:\/|$)/i;

function normalizePath(raw: string): string {
  const path = (raw.split("?")[0] ?? "/").trim() || "/";
  if (path !== "/" && path.endsWith("/")) return path.slice(0, -1) || "/";
  return path;
}

function shouldSkip(path: string): boolean {
  return TRACK_SKIP.test(path);
}

/** Público — registra 1 page view (service role). */
export const trackPageView = createServerFn({ method: "POST" })
  .validator((i: unknown) =>
    z
      .object({
        path: z.string().min(1).max(240),
        session_id: z.string().trim().min(8).max(80),
        referrer: z.string().trim().max(500).optional().nullable(),
        user_id: z.string().uuid().optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const path = normalizePath(data.path);
    if (shouldSkip(path)) return { ok: true as const, skipped: true };

    const { error } = await supabaseAdmin.from("page_views").insert({
      path,
      session_id: data.session_id.trim(),
      referrer: data.referrer?.trim() ? data.referrer.trim().slice(0, 500) : null,
      user_id: data.user_id || null,
    });

    if (error) {
      if (/page_views|schema cache|does not exist/i.test(error.message)) {
        return { ok: false as const, skipped: true };
      }
      throw new Error(error.message);
    }
    return { ok: true as const, skipped: false };
  });

export type PageViewsOverview = {
  total: number;
  today: number;
  last7d: number;
  last30d: number;
  uniqueSessions7d: number;
  uniqueSessions30d: number;
  byPath: { path: string; count: number }[];
  daily: { day: string; count: number }[];
  recent: {
    id: string;
    path: string;
    session_id: string;
    referrer: string | null;
    created_at: string;
  }[];
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgoIso(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export const adminPageViewsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PageViewsOverview> => {
    await assertIsAdmin(context.userId);

    const since30 = daysAgoIso(30);
    const since7 = daysAgoIso(7);
    const todayStart = startOfTodayIso();

    const [allCount, todayCount, c7, c30, agg30, recentRes, seriesRes] =
      await Promise.all([
        supabaseAdmin.from("page_views").select("id", { count: "exact", head: true }),
        supabaseAdmin
          .from("page_views")
          .select("id", { count: "exact", head: true })
          .gte("created_at", todayStart),
        supabaseAdmin
          .from("page_views")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since7),
        supabaseAdmin
          .from("page_views")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since30),
        supabaseAdmin
          .from("page_views")
          .select("path, session_id")
          .gte("created_at", since30)
          .limit(8000),
        supabaseAdmin
          .from("page_views")
          .select("id, path, session_id, referrer, created_at")
          .order("created_at", { ascending: false })
          .limit(40),
        supabaseAdmin
          .from("page_views")
          .select("created_at")
          .gte("created_at", daysAgoIso(13))
          .limit(8000),
      ]);

    if (allCount.error) throw new Error(allCount.error.message);
    if (todayCount.error) throw new Error(todayCount.error.message);
    if (c7.error) throw new Error(c7.error.message);
    if (c30.error) throw new Error(c30.error.message);
    if (agg30.error) throw new Error(agg30.error.message);
    if (recentRes.error) throw new Error(recentRes.error.message);
    if (seriesRes.error) throw new Error(seriesRes.error.message);

    const rows30 = agg30.data ?? [];
    const pathMap = new Map<string, number>();
    const sessions7 = new Set<string>();
    const sessions30 = new Set<string>();

    for (const r of rows30) {
      pathMap.set(r.path, (pathMap.get(r.path) ?? 0) + 1);
      sessions30.add(r.session_id);
    }

    const sess7Res = await supabaseAdmin
      .from("page_views")
      .select("session_id")
      .gte("created_at", since7)
      .limit(8000);
    if (sess7Res.error) throw new Error(sess7Res.error.message);
    for (const r of sess7Res.data ?? []) sessions7.add(r.session_id);

    const byPath = [...pathMap.entries()]
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);

    const dailyMap = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - i);
      dailyMap.set(dayKey(d), 0);
    }
    for (const r of seriesRes.data ?? []) {
      const k = (r.created_at as string).slice(0, 10);
      if (dailyMap.has(k)) dailyMap.set(k, (dailyMap.get(k) ?? 0) + 1);
    }
    const daily = [...dailyMap.entries()].map(([day, count]) => ({ day, count }));

    return {
      total: allCount.count ?? 0,
      today: todayCount.count ?? 0,
      last7d: c7.count ?? 0,
      last30d: c30.count ?? 0,
      uniqueSessions7d: sessions7.size,
      uniqueSessions30d: sessions30.size,
      byPath,
      daily,
      recent: (recentRes.data ?? []).map((r) => ({
        id: r.id as string,
        path: r.path as string,
        session_id: r.session_id as string,
        referrer: (r.referrer as string | null) ?? null,
        created_at: r.created_at as string,
      })),
    };
  });
