const DEFAULT_PIXEL_ID = "D9PIINBC77U97D5QAK00";

/** Código-base inline para o `<head>` (necessário para o verificador do TikTok ler o HTML). */
export const TIKTOK_BASE_PIXEL_SCRIPT = `!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
  ttq.load('${DEFAULT_PIXEL_ID}');
  ttq.page();
}(window, document, 'ttq');`;

type TtqFn = (...args: unknown[]) => void;

type Ttq = {
  page: TtqFn;
  track: TtqFn;
  load: (pixelId: string, opts?: Record<string, unknown>) => void;
  push: (args: unknown[]) => number;
  methods: string[];
  setAndDefer: (target: Ttq, method: string) => void;
  instance: (id: string) => Ttq;
  _i: Record<string, unknown>;
  _t: Record<string, number>;
  _o: Record<string, unknown>;
};

declare global {
  interface Window {
    TiktokAnalyticsObject?: string;
    ttq?: Ttq;
  }
}

function readPixelId(): string {
  try {
    const fromEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_TIKTOK_PIXEL_ID;
    if (fromEnv?.trim()) return fromEnv.trim();
  } catch {
    /* ignore */
  }
  return DEFAULT_PIXEL_ID;
}

let booted = false;

/** Carrega o pixel TikTok uma vez (fallback se o script do head não rodou). */
export function initTikTokPixel() {
  if (typeof window === "undefined" || booted) return;
  // Já injetado no <head> (SSR / HTML inicial)
  if (window.TiktokAnalyticsObject === "ttq" && window.ttq) {
    booted = true;
    return;
  }
  const pixelId = readPixelId();
  if (!pixelId) return;
  booted = true;

  const lib = "ttq";
  window.TiktokAnalyticsObject = lib;

  const ttq = (window.ttq = (window.ttq || []) as unknown as Ttq);
  ttq.methods = [
    "page",
    "track",
    "identify",
    "instances",
    "debug",
    "on",
    "off",
    "once",
    "ready",
    "alias",
    "group",
    "enableCookie",
    "disableCookie",
    "holdConsent",
    "revokeConsent",
    "grantConsent",
  ];
  ttq.setAndDefer = function (target, method) {
    (target as unknown as Record<string, TtqFn>)[method] = function (...args: unknown[]) {
      target.push([method, ...args]);
    };
  };
  for (const method of ttq.methods) {
    ttq.setAndDefer(ttq, method);
  }
  ttq.instance = function (id) {
    const bucket = ((ttq._i ??= {})[id] ??= []) as unknown as Ttq;
    for (const method of ttq.methods) {
      ttq.setAndDefer(bucket, method);
    }
    return bucket;
  };
  ttq.load = function (id, opts) {
    const src = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i ??= {};
    ttq._i[id] = [];
    (ttq._i[id] as { _u?: string })._u = src;
    ttq._t ??= {};
    ttq._t[id] = Date.now();
    ttq._o ??= {};
    ttq._o[id] = opts || {};
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = `${src}?sdkid=${id}&lib=${lib}`;
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(script, first);
  };

  // Array push fallback until SDK hydrates
  if (typeof ttq.push !== "function") {
    const queue = ttq as unknown as unknown[];
    ttq.push = (args) => queue.push(args);
  }

  ttq.load(pixelId);
  ttq.page();
}

export function tiktokPage() {
  try {
    window.ttq?.page();
  } catch {
    /* ignore */
  }
}

export function tiktokTrack(event: string, payload?: Record<string, unknown>) {
  try {
    if (payload) window.ttq?.track(event, payload);
    else window.ttq?.track(event);
  } catch {
    /* ignore */
  }
}

/** Compra: no máximo 1× por aba na página de obrigado. */
export function tiktokTrackPurchaseOnce() {
  const key = "ttq:complete_payment";
  try {
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* private mode — ainda dispara */
  }
  tiktokTrack("CompletePayment");
}
