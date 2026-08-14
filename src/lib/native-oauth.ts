/**
 * Google OAuth no Capacitor: Custom Tabs + deep link (PKCE).
 * No web o fluxo continua no browser normal (sem skipBrowserRedirect).
 */

import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform, openExternalUrl } from "@/lib/platform";

/** Scheme do app Android (appId). Deve bater com AndroidManifest + Supabase Redirect URLs. */
export const NATIVE_OAUTH_REDIRECT = "com.vproject.app://auth";

export function getOAuthRedirectTo(): string {
  if (typeof window === "undefined") return NATIVE_OAUTH_REDIRECT;
  if (isNativePlatform()) return NATIVE_OAUTH_REDIRECT;
  return `${window.location.origin}/auth`;
}

function isOAuthCallbackUrl(url: string): boolean {
  if (!url) return false;
  try {
    if (url.startsWith("com.vproject.app://")) {
      return url.includes("code=") || url.includes("access_token=") || url.includes("error=");
    }
    const u = new URL(url);
    return (
      u.pathname.replace(/\/$/, "") === "/auth" &&
      (u.searchParams.has("code") ||
        u.hash.includes("access_token") ||
        u.searchParams.has("error") ||
        u.hash.includes("error"))
    );
  } catch {
    return url.includes("code=") || url.includes("error=");
  }
}

/**
 * Completa o OAuth a partir da URL do deep link (code PKCE ou tokens).
 * Retorna true se processou um callback.
 */
export async function completeOAuthFromUrl(url: string): Promise<{ handled: boolean; error?: string }> {
  if (!isOAuthCallbackUrl(url)) return { handled: false };

  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close().catch(() => undefined);
  } catch {
    /* web / plugin ausente */
  }

  if (url.includes("error=") || url.includes("error_description=")) {
    try {
      const parsed = new URL(url.replace(/^com\.vproject\.app:/, "https://callback"));
      const msg =
        parsed.searchParams.get("error_description") ||
        parsed.searchParams.get("error") ||
        "Falha no login Google.";
      return { handled: true, error: decodeURIComponent(msg.replace(/\+/g, " ")) };
    } catch {
      return { handled: true, error: "Falha no login Google." };
    }
  }

  if (url.includes("code=")) {
    const { error } = await supabase.auth.exchangeCodeForSession(url);
    if (error) return { handled: true, error: error.message };
    return { handled: true };
  }

  // Só PKCE (`code=`). Tokens no hash/query não são aceitos (hijack de custom scheme).
  if (url.includes("access_token=")) {
    return {
      handled: true,
      error: "Login incompleto. Feche e entre de novo com o Google.",
    };
  }

  return { handled: false };
}

/** Inicia Google OAuth. No nativo: Custom Tabs; no web: redirect padrão. */
export async function startGoogleOAuth(): Promise<{ error?: string }> {
  const redirectTo = getOAuthRedirectTo();
  const native = isNativePlatform();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: native,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error) return { error: error.message || "Erro ao entrar com Google." };

  if (native) {
    if (!data.url) return { error: "URL de autenticação Google indisponível." };
    await openExternalUrl(data.url);
  }

  return {};
}

/**
 * Escuta deep links de OAuth no Capacitor.
 * Chama onSuccess após sessão criada (ex.: navegar para /auth).
 */
export async function attachNativeOAuthDeepLinkListener(handlers: {
  onSuccess: () => void;
  onError?: (message: string) => void;
}): Promise<() => void> {
  if (!isNativePlatform()) return () => undefined;

  const processUrl = async (url: string) => {
    const result = await completeOAuthFromUrl(url);
    if (!result.handled) return;
    if (result.error) {
      handlers.onError?.(result.error);
      return;
    }
    handlers.onSuccess();
  };

  try {
    const { App } = await import("@capacitor/app");

    // Cold start: app aberto pelo redirect do OAuth
    try {
      const launch = await App.getLaunchUrl();
      if (launch?.url) void processUrl(launch.url);
    } catch {
      /* ignore */
    }

    const handle = await App.addListener("appUrlOpen", (event) => {
      void processUrl(event.url);
    });
    return () => {
      void handle.remove();
    };
  } catch (e) {
    console.warn("[native-oauth] appUrlOpen listener", e);
    return () => undefined;
  }
}
