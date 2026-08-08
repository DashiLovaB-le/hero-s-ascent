/**
 * Registro de push nativo (Capacitor) — só Android/iOS.
 */
import { getAppPlatform, ensureCapacitor, isNativePlatform } from "@/lib/platform";

export async function isNativePushAvailable(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  const cap = await ensureCapacitor();
  return Boolean(cap?.isNativePlatform());
}

export async function registerNativePushToken(): Promise<{
  token: string;
  platform: "android" | "ios";
}> {
  if (!isNativePlatform()) {
    throw new Error("Push nativo só está disponível no app V-Project.");
  }

  const { PushNotifications } = await import("@capacitor/push-notifications");
  const platform = getAppPlatform();
  if (platform !== "android" && platform !== "ios") {
    throw new Error("Plataforma sem push nativo.");
  }

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") {
    throw new Error("Permissão de notificação negada.");
  }

  await PushNotifications.register();

  const token = await new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      void remove();
      reject(new Error("Timeout ao obter token FCM. Verifique google-services.json / Firebase."));
    }, 20_000);

    const remove = () => {
      window.clearTimeout(timeout);
      void regHandle.then((h) => h.remove());
      void errHandle.then((h) => h.remove());
    };

    const regHandle = PushNotifications.addListener("registration", (t) => {
      remove();
      resolve(t.value);
    });
    const errHandle = PushNotifications.addListener("registrationError", (e) => {
      remove();
      reject(new Error(e.error || "Falha no registro FCM"));
    });
  });

  return { token, platform };
}

export async function unregisterNativePushListeners(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.removeAllListeners();
  } catch {
    /* ignore */
  }
}

/** Deep link quando o usuário toca a notificação. */
export async function attachNativePushTapHandler(
  onOpen: (href: string) => void,
): Promise<() => void> {
  if (!isNativePlatform()) return () => undefined;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const handle = await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (event) => {
        const data = event.notification.data as Record<string, unknown> | undefined;
        const href = typeof data?.href === "string" ? data.href : "/journey";
        onOpen(href.startsWith("/") ? href : `/${href}`);
      },
    );
    return () => {
      void handle.remove();
    };
  } catch {
    return () => undefined;
  }
}
