import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Marca o tour explicativo da plataforma como visto. */
export const markProductTourSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ tour_visto: true })
      .eq("id", userId);

    if (error) {
      // Coluna ainda não migrada no remoto — client grava localStorage.
      if (/tour_visto|column|schema cache/i.test(error.message)) {
        console.warn("[product-tour] coluna tour_visto ausente:", error.message);
        return { ok: true as const, skipped: true as const };
      }
      throw new Error(error.message);
    }

    return { ok: true as const, skipped: false as const };
  });
