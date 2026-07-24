import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runProductNotificationJobs } from "@/notifications/jobs";

/**
 * Job diário (Fase 2). Protegido por CRON_SECRET.
 * Não importar este módulo no client — só server / cron.
 */
export const runNotificationJobs = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        secret: z.string().min(1),
        force: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const expected = process.env.CRON_SECRET;
    if (!expected || data.secret !== expected) {
      throw new Error("Unauthorized");
    }
    return runProductNotificationJobs({ force: data.force });
  });
