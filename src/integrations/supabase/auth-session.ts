/**
 * Helpers de sessão Supabase — detecta JWT de outro projeto após troca de credenciais.
 */

export function getSupabaseProjectRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname; // <ref>.supabase.co
    const ref = host.split(".")[0];
    return ref || null;
  } catch {
    return null;
  }
}

/** Decodifica payload do JWT sem verificar assinatura (só para checagem de projeto/exp). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getJwtProjectRef(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  if (typeof payload.ref === "string") return payload.ref;
  if (typeof payload.iss === "string") {
    const m = payload.iss.match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
    return m?.[1] ?? null;
  }
  return null;
}

export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number") return true;
  return exp * 1000 <= Date.now() + skewSeconds * 1000;
}
