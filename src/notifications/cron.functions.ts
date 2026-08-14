import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertIsAdmin } from "@/admin/auth";
import { runProductNotificationJobs } from "@/notifications/jobs";

/**
 * Disparo manual autenticado (dashi). Cron de produção usa só a Edge + x-cron-secret.
 */
export const runNotificationJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ force: z.boolean().optional() }).parse(input ?? {}))
  .handler(async ({ context, data }) => {
    await assertIsAdmin(context.userId);
    return runProductNotificationJobs({ force: data.force });
  });
