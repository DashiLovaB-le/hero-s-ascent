import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSupabasePublicEnv } from "@/integrations/supabase/env";
import { assertIsAdmin } from "@/admin/auth";

export const POPUP_TARGET_OPTIONS = [
  { value: "/journey", label: "Jornada" },
  { value: "/habits", label: "Hábitos" },
  { value: "/mentor", label: "Charlie / Mentor" },
  { value: "/goals", label: "Metas" },
  { value: "/profile", label: "Perfil" },
  { value: "/store", label: "Loja" },
  { value: "/onboarding", label: "Onboarding" },
] as const;

export type PopupTargetPath = (typeof POPUP_TARGET_OPTIONS)[number]["value"];

const targetPathSchema = z.enum([
  "/journey",
  "/habits",
  "/mentor",
  "/goals",
  "/profile",
  "/store",
  "/onboarding",
]);

export type AppPopupRow = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  corpo: string;
  image_url: string | null;
  button_label: string;
  target_path: string;
  ativo: boolean;
  starts_at: string;
  expires_at: string;
  priority: number;
  created_at: string;
  updated_at: string;
};

function normalizeIso(input: string): string {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error("Data inválida.");
  return d.toISOString();
}

function assertWindow(startsAt: string, expiresAt: string) {
  if (new Date(expiresAt).getTime() <= new Date(startsAt).getTime()) {
    throw new Error("A expiração deve ser depois do início.");
  }
}

const popupUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(1).max(120),
  subtitulo: z.string().trim().max(200).optional().nullable(),
  corpo: z.string().trim().min(1).max(4000),
  image_url: z.string().trim().max(800).optional().nullable(),
  button_label: z.string().trim().min(1).max(40),
  target_path: targetPathSchema,
  ativo: z.boolean(),
  starts_at: z.string().min(10),
  expires_at: z.string().min(10),
  priority: z.number().int().min(0).max(100),
});

/** Lista todos (admin). */
export const adminListPopups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertIsAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("app_popups")
      .select(
        "id, titulo, subtitulo, corpo, image_url, button_label, target_path, ativo, starts_at, expires_at, priority, created_at, updated_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: (data ?? []) as AppPopupRow[] };
  });

export const adminUpsertPopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => popupUpsertSchema.parse(i))
  .handler(async ({ context, data }) => {
    await assertIsAdmin(context.userId);
    const startsAt = normalizeIso(data.starts_at);
    const expiresAt = normalizeIso(data.expires_at);
    assertWindow(startsAt, expiresAt);

    const patch = {
      titulo: data.titulo,
      subtitulo: data.subtitulo?.trim() ? data.subtitulo.trim() : null,
      corpo: data.corpo,
      image_url: data.image_url?.trim() ? data.image_url.trim() : null,
      button_label: data.button_label || "Entendi",
      target_path: data.target_path,
      ativo: data.ativo,
      starts_at: startsAt,
      expires_at: expiresAt,
      priority: data.priority ?? 0,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("app_popups")
        .update(patch)
        .eq("id", data.id)
        .select(
          "id, titulo, subtitulo, corpo, image_url, button_label, target_path, ativo, starts_at, expires_at, priority, created_at, updated_at",
        )
        .single();
      if (error) throw new Error(error.message);
      return { item: row as AppPopupRow };
    }

    const { data: row, error } = await supabaseAdmin
      .from("app_popups")
      .insert(patch)
      .select(
        "id, titulo, subtitulo, corpo, image_url, button_label, target_path, ativo, starts_at, expires_at, priority, created_at, updated_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return { item: row as AppPopupRow };
  });

export const adminDeletePopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    await assertIsAdmin(context.userId);
    const { error } = await supabaseAdmin.from("app_popups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const adminUploadPopupImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        fileName: z.string().min(1).max(120),
        contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
        base64: z.string().min(32).max(8_000_000),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    await assertIsAdmin(context.userId);
    const ext =
      data.contentType === "image/png"
        ? "png"
        : data.contentType === "image/webp"
          ? "webp"
          : data.contentType === "image/gif"
            ? "gif"
            : "jpg";
    const path = `${context.userId}/${Date.now()}.${ext}`;
    const raw = data.base64.replace(/^data:[^;]+;base64,/, "");
    const bytes = Buffer.from(raw, "base64");
    if (bytes.length > 5_000_000) throw new Error("Imagem maior que 5MB.");

    const { error: upErr } = await supabaseAdmin.storage.from("popup-images").upload(path, bytes, {
      contentType: data.contentType,
      upsert: true,
    });
    if (upErr) throw new Error(upErr.message);

    const { url } = getSupabasePublicEnv();
    const imageUrl = `${url}/storage/v1/object/public/popup-images/${path}`;
    return { ok: true as const, imageUrl };
  });

/**
 * Pop-up ativo para a rota atual (herói autenticado).
 * Match exato de path (ex.: /journey).
 */
export const getActivePopupForPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ path: z.string().min(1).max(120) }).parse(i))
  .handler(async ({ data }) => {
    const path = data.path.split("?")[0]?.replace(/\/$/, "") || "/";
    const now = new Date().toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("app_popups")
      .select(
        "id, titulo, subtitulo, corpo, image_url, button_label, target_path, ativo, starts_at, expires_at, priority",
      )
      .eq("ativo", true)
      .eq("target_path", path)
      .lte("starts_at", now)
      .gt("expires_at", now)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      if (/app_popups|schema cache|does not exist/i.test(error.message)) {
        return { popup: null };
      }
      throw new Error(error.message);
    }

    const row = rows?.[0] ?? null;
    return {
      popup: row
        ? {
            id: row.id as string,
            titulo: row.titulo as string,
            subtitulo: (row.subtitulo as string | null) ?? null,
            corpo: row.corpo as string,
            image_url: (row.image_url as string | null) ?? null,
            button_label: (row.button_label as string) || "Entendi",
            target_path: row.target_path as string,
            expires_at: row.expires_at as string,
          }
        : null,
    };
  });
