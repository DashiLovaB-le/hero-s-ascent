// Server-side auth for TanStack server functions.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getJwtProjectRef } from "./auth-session";
import { getSupabasePublicEnv } from "./env";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    // Prefer VITE_* so server valida o MESMO projeto do bundle client (.env),
    // evitando SUPABASE_URL injetado por outro projeto Lovable Cloud.
    const { url: SUPABASE_URL, publishableKey: SUPABASE_PUBLISHABLE_KEY, projectRef: expectedRef } =
      getSupabasePublicEnv();

    const request = getRequest();

    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      throw new Error("Unauthorized: No authorization header provided");
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Only Bearer tokens are supported");
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      throw new Error("Unauthorized: No token provided");
    }

    if (token.split(".").length !== 3) {
      throw new Error("Unauthorized: Invalid token");
    }

    const tokenRef = getJwtProjectRef(token);
    if (expectedRef && tokenRef && expectedRef !== tokenRef) {
      throw new Error(
        "Unauthorized: Token from a different Supabase project. Sign out and sign in again.",
      );
    }

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) {
      throw new Error(
        `Unauthorized: Invalid token${error?.message ? ` (${error.message})` : ""}. Sign out and sign in again.`,
      );
    }

    if (!data.claims.sub) {
      throw new Error("Unauthorized: No user ID found in token");
    }

    return next({
      context: {
        supabase,
        userId: data.claims.sub,
        claims: data.claims,
      },
    });
  },
);
