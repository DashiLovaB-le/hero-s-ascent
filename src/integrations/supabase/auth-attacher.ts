// Attaches the Supabase access token to every server function call from the browser.
import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";
import {
  getJwtProjectRef,
  getSupabaseProjectRefFromUrl,
  isJwtExpired,
} from "./auth-session";
import { clearAllSupabaseAuthStorage } from "./env";

// Must be registered as a global `functionMiddleware` in `src/start.ts`; otherwise
// the browser never attaches the bearer token to serverFn RPCs.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const expectedRef = getSupabaseProjectRefFromUrl(
      (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
        (import.meta.env.SUPABASE_URL as string | undefined),
    );

    let { data } = await supabase.auth.getSession();
    let token = data.session?.access_token;

    // Sessão de outro projeto → limpa TODAS as chaves sb-*-auth e não envia token
    if (token && expectedRef) {
      const tokenRef = getJwtProjectRef(token);
      if (tokenRef && tokenRef !== expectedRef) {
        clearAllSupabaseAuthStorage();
        await supabase.auth.signOut({ scope: "local" });
        token = undefined;
      }
    }

    if (token && isJwtExpired(token, 60)) {
      const refreshed = await supabase.auth.refreshSession();
      token = refreshed.data.session?.access_token;
      if (!token) {
        clearAllSupabaseAuthStorage();
        await supabase.auth.signOut({ scope: "local" });
      }
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
