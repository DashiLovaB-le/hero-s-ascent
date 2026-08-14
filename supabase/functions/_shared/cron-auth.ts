/**
 * Auth de cron nas Edge Functions (Deno).
 * Só POST + header x-cron-secret (timing-safe). Não aceita secret no body.
 */
export function assertCronPost(req: Request): Response | null {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  const expected = (Deno.env.get("CRON_SECRET") ?? "").trim();
  const provided = (req.headers.get("x-cron-secret") ?? "").trim();
  if (!expected || !timingSafeEqualStr(expected, provided)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i]! ^ bb[i]!;
  return diff === 0;
}
