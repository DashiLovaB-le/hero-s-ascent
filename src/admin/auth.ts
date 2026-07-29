import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

/** Role privilegiada do control room `/dashitecnology`. */
export const DASHI_ROLE = "dashi" as const satisfies Database["public"]["Enums"]["app_role"];

/** Garante que o userId tem role `dashi` (via service role). */
export async function assertIsAdmin(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", DASHI_ROLE)
    .maybeSingle();

  if (error) throw new Error(`Dashi check failed: ${error.message}`);
  if (!data) throw new Error("Forbidden: apenas role dashi.");
}

export async function countAdmins(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", DASHI_ROLE);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", DASHI_ROLE)
    .maybeSingle();
  return Boolean(data);
}
