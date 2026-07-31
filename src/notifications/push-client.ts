/** Helpers client-side para Web Push (browser only). */

import {
  analyzeVapidPublicKey,
  decodeVapidPublicKey,
  sanitizeVapidKey,
} from "@/notifications/push-config";

export function isWebPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isLocalHostName(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** Push exige secure context: https OU localhost/127.0.0.1 (não IP da LAN em HTTP). */
export function getPushEnvironmentIssue(): string | null {
  if (typeof window === "undefined") return null;
  if (!isWebPushSupported()) {
    return "Este navegador não suporta Web Push.";
  }
  const host = window.location.hostname;
  const isLocalHost = isLocalHostName(host);
  if (!window.isSecureContext || (!isLocalHost && window.location.protocol !== "https:")) {
    return `Push exige HTTPS ou localhost. Você está em ${window.location.protocol}//${host}.`;
  }
  return null;
}

/** registration ativa e pronta para PushManager.subscribe (padrão MDN). */
export async function ensurePushServiceWorker() {
  const envIssue = getPushEnvironmentIssue();
  if (envIssue) throw new Error(envIssue);

  await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });

  // `ready` só resolve com worker ativo — evita race "push service error"
  const reg = await navigator.serviceWorker.ready;
  if (!reg.active) {
    throw new Error("Service worker ainda não está ativo. Recarregue a página e tente de novo.");
  }
  return reg;
}

function mapSubscribeError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  const name = e instanceof Error ? e.name : "";
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const local = isLocalHostName(host);

  if (/push service error|Registration failed/i.test(msg) || name === "AbortError") {
    if (local) {
      return new Error(
        "Falha no push em ambiente local. Use http://localhost:8080 (não o IP da rede), " +
          "aceite a permissão, e se persistir: DevTools → Application → Service Workers → Unregister.",
      );
    }
    return new Error(
      "O navegador não registrou o push (serviço FCM). Confira: Chrome/Edge (no Brave ative " +
        "“Use Google services for push messaging”), permissão concedida, e o par VAPID " +
        "(VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY) no Vercel. Depois: Application → Service Workers → Unregister e tente de novo.",
    );
  }
  if (/denied|NotAllowedError|permission/i.test(msg) || name === "NotAllowedError") {
    return new Error(
      "Permissão de notificação negada. Libere nas configurações do site no navegador.",
    );
  }
  if (/no active Service Worker/i.test(msg)) {
    return new Error(
      "Service worker inativo. Recarregue a página e ative o push de novo.",
    );
  }
  return e instanceof Error ? e : new Error(msg);
}

export async function subscribeBrowserPush(vapidPublicKey: string) {
  const analyzed = analyzeVapidPublicKey(vapidPublicKey);
  if (!analyzed.valid || !analyzed.publicKey) {
    throw new Error(
      `Chave VAPID pública inválida (len=${analyzed.keyLength}, bytes=${analyzed.byteLength}). ` +
        "No Vercel, use o par gerado por `npx web-push generate-vapid-keys` em VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY.",
    );
  }

  const keyBytes = decodeVapidPublicKey(analyzed.publicKey);
  // Cópia num ArrayBuffer “limpo” — tipagem DOM BufferSource + Chrome
  const applicationServerKey = keyBytes.buffer.slice(
    keyBytes.byteOffset,
    keyBytes.byteOffset + keyBytes.byteLength,
  ) as ArrayBuffer;
  const reg = await ensurePushServiceWorker();

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificação negada pelo navegador.");
  }

  // Subscription antiga (ex.: outra chave VAPID) quebra o subscribe — limpa antes
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    try {
      await existing.unsubscribe();
    } catch {
      /* ignore */
    }
  }

  try {
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  } catch (e) {
    // Uma retry curta após ready de novo (sem unregister agressivo)
    await new Promise((r) => setTimeout(r, 400));
    const ready = await navigator.serviceWorker.ready;
    try {
      return await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    } catch (e2) {
      throw mapSubscribeError(e2 ?? e);
    }
  }
}

export async function unsubscribeBrowserPush() {
  if (!isWebPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}

export function subscriptionToKeys(sub: PushSubscription) {
  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("Subscription inválida (keys ausentes).");
  }
  return {
    endpoint: json.endpoint,
    p256dh,
    auth,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 512) : undefined,
  };
}

export function clientVapidPublicKeyFromEnv(): string | undefined {
  try {
    const fromVite = sanitizeVapidKey(
      (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_VAPID_PUBLIC_KEY,
    );
    const analyzed = analyzeVapidPublicKey(fromVite);
    return analyzed.publicKey ?? undefined;
  } catch {
    return undefined;
  }
}
