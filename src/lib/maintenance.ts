import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertIsAdmin, isUserAdmin } from "@/admin/auth";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MaintenanceStatus = {
  enabled: boolean;
  title: string;
  message: string;
  eta: string | null;
  updatedAt: string | null;
};

const DEFAULTS: MaintenanceStatus = {
  enabled: false,
  title: "Em manutenção",
  message:
    "Estamos preparando a próxima etapa da jornada. Voltamos em breve — sua progressão está segura.",
  eta: null,
  updatedAt: null,
};

const KEYS = {
  mode: "maintenance_mode",
  title: "maintenance_title",
  message: "maintenance_message",
  eta: "maintenance_eta",
} as const;

let cache: { at: number; value: MaintenanceStatus } | null = null;
const CACHE_TTL_MS = 5_000;

function invalidateMaintenanceCache() {
  cache = null;
}

function parseEnabled(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

export async function readMaintenanceStatus(): Promise<MaintenanceStatus> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.value;

  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("key, value, updated_at")
    .in("key", Object.values(KEYS));

  if (error) {
    // Tabela ainda não migrada / falha transitória → app aberto
    console.error("[maintenance] read", error.message);
    return DEFAULTS;
  }

  const map = new Map((data ?? []).map((r) => [r.key, r]));
  const mode = map.get(KEYS.mode);
  const title = map.get(KEYS.title);
  const message = map.get(KEYS.message);
  const eta = map.get(KEYS.eta);

  const status: MaintenanceStatus = {
    enabled: parseEnabled(mode?.value),
    title: title?.value?.trim() || DEFAULTS.title,
    message: message?.value?.trim() || DEFAULTS.message,
    eta: eta?.value?.trim() ? eta.value.trim() : null,
    updatedAt: mode?.updated_at ?? title?.updated_at ?? null,
  };

  cache = { at: now, value: status };
  return status;
}

/** Público — usado pelo gate e pela página /maintenance. */
export const getMaintenanceStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<MaintenanceStatus> => readMaintenanceStatus(),
);

/** True se o usuário autenticado é dashi (libera app durante manutenção). */
export const canBypassMaintenance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const bypass = await isUserAdmin(context.userId);
    return { bypass };
  });

export const adminGetMaintenance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertIsAdmin(context.userId);
    return readMaintenanceStatus();
  });

export const adminSetMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        title: z.string().trim().min(2).max(80),
        message: z.string().trim().min(8).max(600),
        eta: z.string().trim().max(120).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertIsAdmin(context.userId);
    const now = new Date().toISOString();
    const eta = data.eta?.trim() || "";

    const rows = [
      { key: KEYS.mode, value: data.enabled ? "true" : "false", updated_at: now, updated_by: context.userId },
      { key: KEYS.title, value: data.title, updated_at: now, updated_by: context.userId },
      { key: KEYS.message, value: data.message, updated_at: now, updated_by: context.userId },
      { key: KEYS.eta, value: eta, updated_at: now, updated_by: context.userId },
    ];

    const { error } = await supabaseAdmin.from("app_settings").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);

    invalidateMaintenanceCache();
    return readMaintenanceStatus();
  });

/** Paths liberados mesmo com manutenção ligada (além de dashis). */
export function isMaintenanceAllowlistedPath(pathname: string): boolean {
  if (pathname === "/maintenance") return true;
  if (pathname === "/auth") return true;
  if (pathname === "/dashitecnology" || pathname.startsWith("/dashitecnology/")) return true;
  return false;
}
