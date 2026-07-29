import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertIsAdmin, DASHI_ROLE } from "@/admin/auth";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSupabasePublicEnv } from "@/integrations/supabase/env";
import { loadLevelsFromDb, loadWallpapersFromDb } from "@/lib/catalog.server";
import { LEVELS } from "@/lib/journey";

async function withDashi(userId: string) {
  await assertIsAdmin(userId);
}

// ---------- PUBLIC (auth) catalog reads ----------

export const listLevelsPublic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { levels: await loadLevelsFromDb() };
  });

export const listWallpapersPublic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const wallpapers = await loadWallpapersFromDb();
    return { wallpapers };
  });

// ---------- LEVELS admin ----------

export const adminListLevels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withDashi(context.userId);
    const { data, error } = await supabaseAdmin
      .from("levels")
      .select("nivel, titulo, xp_necessario, descricao")
      .order("xp_necessario", { ascending: true });
    if (error) throw new Error(error.message);
    return { levels: data ?? [] };
  });

export const adminUpsertLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        nivel: z.number().int().min(1).max(99),
        titulo: z.string().trim().min(1).max(80),
        xp_necessario: z.number().int().min(0).max(10_000_000),
        descricao: z.string().trim().max(280).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await withDashi(context.userId);
    const { error } = await supabaseAdmin.from("levels").upsert(
      {
        nivel: data.nivel,
        titulo: data.titulo,
        xp_necessario: data.xp_necessario,
        descricao: data.descricao ?? null,
      },
      { onConflict: "nivel" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ nivel: z.number().int().min(2).max(99) }).parse(i))
  .handler(async ({ context, data }) => {
    await withDashi(context.userId);
    if (data.nivel === 1) throw new Error("Não é possível excluir o nível 1.");
    const { error } = await supabaseAdmin.from("levels").delete().eq("nivel", data.nivel);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminResetLevelsSeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withDashi(context.userId);
    const rows = LEVELS.map((l) => ({
      nivel: l.nivel,
      titulo: l.titulo,
      xp_necessario: l.xp_necessario,
      descricao: null as string | null,
    }));
    const { error } = await supabaseAdmin.from("levels").upsert(rows, { onConflict: "nivel" });
    if (error) throw new Error(error.message);
    return { ok: true as const, count: rows.length };
  });

// ---------- WALLPAPERS admin ----------

const unlockKindSchema = z.enum(["always", "level", "streak_max", "chapter", "xp"]);

export const adminListWallpapers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withDashi(context.userId);
    const { data, error } = await supabaseAdmin
      .from("wallpaper_catalog")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { wallpapers: data ?? [] };
  });

export const adminUpsertWallpaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        id: z
          .string()
          .trim()
          .min(1)
          .max(40)
          .regex(/^[a-z0-9][a-z0-9_-]*$/i, "id inválido"),
        titulo: z.string().trim().min(1).max(80),
        descricao: z.string().trim().max(280).optional(),
        file_name: z.string().trim().max(120).nullable().optional(),
        image_url: z
          .union([z.string().url(), z.literal(""), z.null()])
          .optional()
          .transform((v) => (v === "" || v == null ? null : v)),
        unlock_kind: unlockKindSchema,
        unlock_min: z.number().int().min(0).max(10_000_000),
        sort_order: z.number().int().min(0).max(10_000).optional(),
        ativo: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await withDashi(context.userId);
    const { error } = await supabaseAdmin.from("wallpaper_catalog").upsert(
      {
        id: data.id,
        titulo: data.titulo,
        descricao: data.descricao ?? "",
        file_name: data.file_name ?? null,
        image_url: data.image_url || null,
        unlock_kind: data.unlock_kind,
        unlock_min: data.unlock_kind === "always" ? 0 : data.unlock_min,
        sort_order: data.sort_order ?? 0,
        ativo: data.ativo ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminDeleteWallpaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().min(1) }).parse(i))
  .handler(async ({ context, data }) => {
    await withDashi(context.userId);
    if (data.id === "none") throw new Error("Não é possível excluir o wallpaper padrão.");
    const { error } = await supabaseAdmin.from("wallpaper_catalog").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Upload base64 → Storage wallpapers; devolve URL pública. */
export const adminUploadWallpaperImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        wallpaperId: z.string().min(1).max(40),
        fileName: z.string().min(1).max(120),
        contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
        base64: z.string().min(32).max(8_000_000),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await withDashi(context.userId);
    const ext =
      data.contentType === "image/png"
        ? "png"
        : data.contentType === "image/webp"
          ? "webp"
          : data.contentType === "image/gif"
            ? "gif"
            : "jpg";
    const path = `${data.wallpaperId}/${Date.now()}.${ext}`;
    const raw = data.base64.replace(/^data:[^;]+;base64,/, "");
    const bytes = Buffer.from(raw, "base64");
    if (bytes.length > 5_000_000) throw new Error("Imagem maior que 5MB.");

    const { error: upErr } = await supabaseAdmin.storage.from("wallpapers").upload(path, bytes, {
      contentType: data.contentType,
      upsert: true,
    });
    if (upErr) throw new Error(upErr.message);

    const { url } = getSupabasePublicEnv();
    const publicUrl = `${url}/storage/v1/object/public/wallpapers/${path}`;

    const { error } = await supabaseAdmin
      .from("wallpaper_catalog")
      .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", data.wallpaperId);
    if (error) throw new Error(error.message);

    return { ok: true as const, imageUrl: publicUrl, path };
  });

// ---------- AI TOKENS ----------

export const adminAiUsageOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await withDashi(context.userId);
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();

    const [ev7, ev30, rates, recent] = await Promise.all([
      supabaseAdmin
        .from("ai_usage_events")
        .select("prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd")
        .gte("created_at", since7),
      supabaseAdmin
        .from("ai_usage_events")
        .select("prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd")
        .gte("created_at", since30),
      supabaseAdmin.from("ai_cost_rates").select("*").order("model"),
      supabaseAdmin
        .from("ai_usage_events")
        .select(
          "id, user_id, source, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

    function sum(rows: typeof ev7.data) {
      let prompt = 0;
      let completion = 0;
      let total = 0;
      let cost = 0;
      for (const r of rows ?? []) {
        prompt += r.prompt_tokens;
        completion += r.completion_tokens;
        total += r.total_tokens;
        cost += Number(r.estimated_cost_usd) || 0;
      }
      return { prompt, completion, total, cost, calls: rows?.length ?? 0 };
    }

    const s7 = sum(ev7.data);
    const s30 = sum(ev30.data);

    // Projeção mensal simples: (7d cost / 7) * 30
    const projectedMonthUsd = s7.calls > 0 ? (s7.cost / 7) * 30 : s30.cost;

    return {
      last7d: s7,
      last30d: s30,
      projectedMonthUsd,
      rates: rates.data ?? [],
      recent: recent.data ?? [],
      errors: {
        ev7: ev7.error?.message ?? null,
        ev30: ev30.error?.message ?? null,
      },
      role: DASHI_ROLE,
    };
  });

export const adminUpsertAiRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        model: z.string().trim().min(1).max(120),
        input_usd_per_1m: z.number().min(0).max(1000),
        output_usd_per_1m: z.number().min(0).max(1000),
        notes: z.string().trim().max(280).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await withDashi(context.userId);
    const { error } = await supabaseAdmin.from("ai_cost_rates").upsert(
      {
        model: data.model,
        input_usd_per_1m: data.input_usd_per_1m,
        output_usd_per_1m: data.output_usd_per_1m,
        notes: data.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "model" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
