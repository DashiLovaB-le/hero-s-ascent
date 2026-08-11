import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getSupabasePublicEnv } from "@/integrations/supabase/env";
import { assertIsAdmin } from "@/admin/auth";

/** Atalhos comuns no formulário admin — qualquer path fora de /dashitecnology é aceito. */
export const POPUP_TARGET_OPTIONS = [
  { value: "/journey", label: "Jornada" },
  { value: "/habits", label: "Hábitos" },
  { value: "/mentor", label: "Charlie / Mentor" },
  { value: "/goals", label: "Metas" },
  { value: "/profile", label: "Perfil" },
  { value: "/identity", label: "Identidade / Alter ego" },
  { value: "/store", label: "Loja" },
  { value: "/fitness", label: "Fitness" },
  { value: "/exercises/ranking", label: "Ranking de exercícios" },
  { value: "/onboarding", label: "Onboarding" },
] as const;

export type PopupTargetPath = string;

const POPUP_TARGET_PATH_RE = /^\/(?:[A-Za-z0-9._~\-]+(?:\/[A-Za-z0-9._~\-]+)*)?$/;

/** Normaliza path de rota (sem query/hash; sem trailing slash, exceto root). */
export function normalizePopupTargetPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Informe a página alvo.");
  const withoutQuery = trimmed.split("?")[0]?.split("#")[0]?.trim() ?? "";
  if (!withoutQuery) throw new Error("Informe a página alvo.");
  let path = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  if (path.length > 1) path = path.replace(/\/+$/, "") || "/";
  return path;
}

export function assertAllowedPopupTargetPath(path: string): string {
  const normalized = normalizePopupTargetPath(path);
  if (normalized.length > 120) {
    throw new Error("A página alvo deve ter no máximo 120 caracteres.");
  }
  if (normalized === "/dashitecnology" || normalized.startsWith("/dashitecnology/")) {
    throw new Error("Não é possível definir pop-ups no módulo dashitecnology.");
  }
  if (!POPUP_TARGET_PATH_RE.test(normalized)) {
    throw new Error("Caminho inválido. Use um path como /journey ou /fitness/workout/meu-treino.");
  }
  return normalized;
}

const targetPathSchema = z
  .string()
  .trim()
  .min(1, "Informe a página alvo.")
  .max(120)
  .transform((value, ctx) => {
    try {
      return assertAllowedPopupTargetPath(value);
    } catch (err) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : "Página alvo inválida.",
      });
      return z.NEVER;
    }
  });

export type AppPopupRow = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  corpo: string;
  image_url: string | null;
  button_label: string;
  body_link_ativo: boolean;
  body_link_label: string | null;
  body_link_url: string | null;
  target_path: string;
  ativo: boolean;
  starts_at: string;
  expires_at: string;
  priority: number;
  created_at: string;
  updated_at: string;
};

const POPUP_SELECT =
  "id, titulo, subtitulo, corpo, image_url, button_label, body_link_ativo, body_link_label, body_link_url, target_path, ativo, starts_at, expires_at, priority, created_at, updated_at";

const POPUP_SELECT_ACTIVE =
  "id, titulo, subtitulo, corpo, image_url, button_label, body_link_ativo, body_link_label, body_link_url, target_path, ativo, starts_at, expires_at, priority";

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function normalizeBodyLinkUrl(value: string | null | undefined): string | null {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("O link do corpo deve começar com http:// ou https://");
    }
    return url.toString();
  } catch (err) {
    if (err instanceof Error && err.message.includes("http")) throw err;
    throw new Error("URL do link do corpo inválida.");
  }
}

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

const popupUpsertSchema = z
  .object({
    id: z.string().uuid().optional(),
    titulo: z.string().trim().min(1).max(120),
    subtitulo: z.string().trim().max(200).optional().nullable(),
    corpo: z.string().trim().min(1).max(4000),
    image_url: z.string().trim().max(800).optional().nullable(),
    button_label: z.string().trim().min(1).max(40),
    body_link_ativo: z.boolean().default(false),
    body_link_label: z.string().trim().max(60).optional().nullable(),
    body_link_url: z.string().trim().max(800).optional().nullable(),
    target_path: targetPathSchema,
    ativo: z.boolean(),
    starts_at: z.string().min(10),
    expires_at: z.string().min(10),
    priority: z.number().int().min(0).max(100),
  })
  .superRefine((data, ctx) => {
    if (!data.body_link_ativo) return;
    const label = data.body_link_label?.trim() ?? "";
    const url = data.body_link_url?.trim() ?? "";
    if (!label) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o nome do botão de link no corpo.",
        path: ["body_link_label"],
      });
    }
    if (!url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o link do botão no corpo.",
        path: ["body_link_url"],
      });
    }
  });

/** Lista todos (admin). */
export const adminListPopups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertIsAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("app_popups")
      .select(POPUP_SELECT)
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

    const bodyLinkLabel = normalizeOptionalText(data.body_link_label);
    const bodyLinkUrl = normalizeBodyLinkUrl(data.body_link_url);
    const bodyLinkAtivo = Boolean(data.body_link_ativo && bodyLinkLabel && bodyLinkUrl);

    const patch = {
      titulo: data.titulo,
      subtitulo: data.subtitulo?.trim() ? data.subtitulo.trim() : null,
      corpo: data.corpo,
      image_url: data.image_url?.trim() ? data.image_url.trim() : null,
      button_label: data.button_label || "Entendi",
      body_link_ativo: bodyLinkAtivo,
      body_link_label: bodyLinkLabel,
      body_link_url: bodyLinkUrl,
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
        .select(POPUP_SELECT)
        .single();
      if (error) throw new Error(error.message);
      return { item: row as AppPopupRow };
    }

    const { data: row, error } = await supabaseAdmin
      .from("app_popups")
      .insert(patch)
      .select(POPUP_SELECT)
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
    let path: string;
    try {
      path = normalizePopupTargetPath(data.path);
    } catch {
      return { popup: null };
    }
    // Admin nunca exibe pop-ups no control room.
    if (path === "/dashitecnology" || path.startsWith("/dashitecnology/")) {
      return { popup: null };
    }
    const now = new Date().toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("app_popups")
      .select(POPUP_SELECT_ACTIVE)
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
    const bodyLinkLabel = (row?.body_link_label as string | null) ?? null;
    const bodyLinkUrl = (row?.body_link_url as string | null) ?? null;
    const bodyLinkAtivo = Boolean(row?.body_link_ativo && bodyLinkLabel && bodyLinkUrl);

    return {
      popup: row
        ? {
            id: row.id as string,
            titulo: row.titulo as string,
            subtitulo: (row.subtitulo as string | null) ?? null,
            corpo: row.corpo as string,
            image_url: (row.image_url as string | null) ?? null,
            button_label: (row.button_label as string) || "Entendi",
            body_link_ativo: bodyLinkAtivo,
            body_link_label: bodyLinkAtivo ? bodyLinkLabel : null,
            body_link_url: bodyLinkAtivo ? bodyLinkUrl : null,
            target_path: row.target_path as string,
            expires_at: row.expires_at as string,
          }
        : null,
    };
  });
