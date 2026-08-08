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

/** Splash / status bar / app listeners — só nativo. */
export async function initNativeShell(): Promise<void> {
  if (typeof window === "undefined") return;
  const cap = await loadCapacitor();
  if (!cap?.isNativePlatform()) return;

  document.documentElement.classList.add("native-shell");

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // Não desenhar sob a status bar — safe area superior nativa
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#1B1B1B" });
    await StatusBar.show();
  } catch (e) {
    console.warn("[native] statusbar", e);
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
