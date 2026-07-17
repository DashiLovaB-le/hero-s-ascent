/**
 * Fonte única das credenciais Supabase.
 * Prefere VITE_* (mesmo valor do bundle client) para evitar desalinhamento
 * quando o host injeta SUPABASE_URL de outro projeto Lovable Cloud.
 *
 * IMPORTANTE: acessos a import.meta.env.VITE_* devem ser estáticos
 * para o Vite substituir no build.
 */

export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
  projectRef: string | null;
};

function viteEnv(key: "VITE_SUPABASE_URL" | "VITE_SUPABASE_PUBLISHABLE_KEY"): string | undefined {
  try {
    if (key === "VITE_SUPABASE_URL") return import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (key === "VITE_SUPABASE_PUBLISHABLE_KEY") {
      return import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function processEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env[name];
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url =
    viteEnv("VITE_SUPABASE_URL") ||
    processEnv("VITE_SUPABASE_URL") ||
    processEnv("SUPABASE_URL") ||
    "";
  const publishableKey =
    viteEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    processEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    processEnv("SUPABASE_PUBLISHABLE_KEY") ||
    "";

  if (!url || !publishableKey) {
    const missing = [
      ...(!url ? ["VITE_SUPABASE_URL / SUPABASE_URL"] : []),
      ...(!publishableKey ? ["VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}.`);
  }

  let projectRef: string | null = null;
  try {
    projectRef = new URL(url).hostname.split(".")[0] || null;
  } catch {
    projectRef = null;
  }

  return { url, publishableKey, projectRef };
}

/** Remove sessões de QUALQUER projeto Supabase no localStorage. */
export function clearAllSupabaseAuthStorage(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k) continue;
    if (k.startsWith("sb-") && k.includes("auth")) {
      keys.push(k);
    }
  }
  for (const k of keys) {
    window.localStorage.removeItem(k);
  }
}
