/** Helpers client-side para Web Push (browser only). */

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function isWebPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Push exige secure context: https OU localhost/127.0.0.1 (não IP da LAN). */
export function getPushEnvironmentIssue(): string | null {
  if (typeof window === "undefined") return null;
  if (!isWebPushSupported()) {
    return "Este navegador não suporta Web Push.";
  }
  const host = window.location.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (!window.isSecureContext || (!isLocalHost && window.location.protocol !== "https:")) {
    return `Abra em http://localhost:8080 (não use ${host} via HTTP). Push no Chrome exige localhost ou HTTPS.`;
  }
  return null;
}

export async function ensurePushServiceWorker() {
  const envIssue = getPushEnvironmentIssue();
  if (envIssue) throw new Error(envIssue);

  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  if (reg.installing) {
    await new Promise<void>((resolve, reject) => {
      const w = reg.installing!;
      w.addEventListener("statechange", () => {
        if (w.state === "activated") resolve();
        if (w.state === "redundant") reject(new Error("Service worker falhou ao ativar."));
      });
    });
  }
  if (!reg.active) {
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!reg.active) {
    throw new Error("Service worker ainda não está ativo. Recarregue a página e tente de novo.");
  }
  return reg;
}

function mapSubscribeError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  const name = e instanceof Error ? e.name : "";
  if (/push service error|Registration failed/i.test(msg) || name === "AbortError") {
    return new Error(
      "Falha no serviço de push do navegador. Use http://localhost:8080 (não o IP da rede), " +
        "aceite a permissão, e se persistir: DevTools → Application → Service Workers → Unregister, depois tente de novo.",
    );
  }
  if (/denied|permission/i.test(msg)) {
    return new Error(
      "Permissão de notificação negada. Libere nas configurações do site no navegador.",
    );
  }
  return e instanceof Error ? e : new Error(msg);
}

export async function subscribeBrowserPush(vapidPublicKey: string) {
  const key = vapidPublicKey.trim();
  if (key.length < 80) {
    throw new Error("Chave VAPID pública inválida no servidor.");
  }

  const reg = await ensurePushServiceWorker();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificação negada pelo navegador.");
  }

  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    try {
      const json = existing.toJSON();
      if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
        return existing;
      }
    } catch {
      /* fallthrough */
    }
    try {
      await existing.unsubscribe();
    } catch {
      /* ignore */
    }
  }

  try {
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  } catch (e) {
    try {
      await reg.unregister();
    } catch {
      /* ignore */
    }
    const fresh = await ensurePushServiceWorker();
    try {
      return await fresh.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
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
