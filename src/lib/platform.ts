/**
 * Camada única native/web — nunca importar plugins Capacitor sem passar por aqui.
 * No web/SSR: no-ops seguros (não quebra Vite/TanStack).
 */

export type AppPlatform = "web" | "android" | "ios";

type CapacitorBridge = {
  isNativePlatform: () => boolean;
  getPlatform: () => string;
};

let capacitorPromise: Promise<CapacitorBridge | null> | null = null;

async function loadCapacitor(): Promise<CapacitorBridge | null> {
  if (typeof window === "undefined") return null;
  if (!capacitorPromise) {
    capacitorPromise = import("@capacitor/core")
      .then((m) => m.Capacitor as CapacitorBridge)
      .catch(() => null);
  }
  return capacitorPromise;
}

/** Sync-ish: usa Capacitor global se já injetado; senão assume web. */
export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cap = (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
    if (cap?.isNativePlatform) return Boolean(cap.isNativePlatform());
  } catch {
    /* ignore */
  }
  return false;
}

export function getAppPlatform(): AppPlatform {
  if (typeof window === "undefined") return "web";
  try {
    const cap = (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
    if (cap?.isNativePlatform?.()) {
      const p = (cap.getPlatform?.() ?? "").toLowerCase();
      if (p === "ios") return "ios";
      if (p === "android") return "android";
      return "android";
    }
  } catch {
    /* ignore */
  }
  return "web";
}

export async function ensureCapacitor(): Promise<CapacitorBridge | null> {
  return loadCapacitor();
}

/** Splash / system bars / teclado / app listeners — só nativo. */
export async function initNativeShell(): Promise<void> {
  if (typeof window === "undefined") return;
  const cap = await loadCapacitor();
  if (!cap?.isNativePlatform()) return;

  document.documentElement.classList.add("native-shell");

  // Cap 8: SystemBars (edge-to-edge). StatusBar.overlaysWebView não funciona no Android 15/16.
  try {
    const { SystemBars, SystemBarsStyle } = await import("@capacitor/core");
    await SystemBars.setStyle({ style: SystemBarsStyle.Dark });
  } catch (e) {
    console.warn("[native] systembars", e);
  }

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    // Best-effort em Android ≤14; no-op em 15/16
    await StatusBar.setBackgroundColor({ color: "#1B1B1B" });
  } catch (e) {
    console.warn("[native] statusbar", e);
  }

  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    const root = document.documentElement;
    const onShow = () => {
      root.classList.add("keyboard-open");
      // Garante o campo focado visível sem “pulo” estranho
      requestAnimationFrame(() => {
        const el = document.activeElement;
        if (el instanceof HTMLElement) {
          el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        }
      });
    };
    const onHide = () => root.classList.remove("keyboard-open");
    await Keyboard.addListener("keyboardDidShow", onShow);
    await Keyboard.addListener("keyboardDidHide", onHide);
  } catch (e) {
    console.warn("[native] keyboard", e);
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 280 });
  } catch (e) {
    console.warn("[native] splash", e);
  }

  try {
    const { App } = await import("@capacitor/app");
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        void App.minimizeApp();
      }
    });
  } catch (e) {
    console.warn("[native] app listeners", e);
  }
}

/** Abre URL externa (OAuth, Telegram) — Custom Tabs no Android. */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  const cap = await loadCapacitor();
  if (cap?.isNativePlatform()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    } catch (e) {
      console.warn("[native] browser open failed, fallback", e);
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export type CameraPermissionResult =
  | { ok: true }
  | { ok: false; reason: "denied" | "unavailable"; message: string };

/**
 * Garante permissão de câmera antes do getUserMedia.
 * Web: no-op (o browser pede no getUserMedia).
 * Nativo: check/request via @capacitor/camera (mesmo permission CAMERA do Manifest).
 */
export async function ensureCameraPermission(): Promise<CameraPermissionResult> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "unavailable", message: "Câmera indisponível." };
  }

  const cap = await loadCapacitor();
  if (!cap?.isNativePlatform()) {
    return { ok: true };
  }

  try {
    const { Camera } = await import("@capacitor/camera");
    let status = await Camera.checkPermissions();
    if (status.camera === "granted" || status.camera === "limited") {
      return { ok: true };
    }
    status = await Camera.requestPermissions({ permissions: ["camera"] });
    if (status.camera === "granted" || status.camera === "limited") {
      return { ok: true };
    }
    return {
      ok: false,
      reason: "denied",
      message:
        "Permissão da câmera negada. Abra as configurações do app e permita o acesso à câmera para validar flexões.",
    };
  } catch (e) {
    console.warn("[native] camera permission", e);
    // Fallback: deixa o getUserMedia tentar (WebChromeClient do Capacitor)
    return { ok: true };
  }
}

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * Mantém a tela acesa durante a sessão de flexão.
 * Preferência: Screen Wake Lock API (Chrome WebView). No-op seguro no web se indisponível.
 */
export async function requestSessionWakeLock(): Promise<() => void> {
  if (typeof navigator === "undefined") return () => undefined;

  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
  };

  if (!nav.wakeLock?.request) return () => undefined;

  let sentinel: WakeLockSentinelLike | null = null;
  let released = false;

  const acquire = async () => {
    try {
      sentinel = await nav.wakeLock!.request("screen");
    } catch (e) {
      console.warn("[wake-lock]", e);
      sentinel = null;
    }
  };

  await acquire();

  const onVisibility = () => {
    if (document.visibilityState === "visible" && !released) {
      void acquire();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    released = true;
    document.removeEventListener("visibilitychange", onVisibility);
    void sentinel?.release().catch(() => undefined);
    sentinel = null;
  };
}
