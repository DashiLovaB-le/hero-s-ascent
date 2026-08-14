/** CSP Report-Only: câmera (exercícios) + TikTok pixel + Open-Meteo + Supabase. */
export const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://analytics.tiktok.com https://*.tiktok.com https://*.ttwstatic.com https://*.byteoversea.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://analytics.tiktok.com https://analytics-sg.tiktok.com https://business-api.tiktok.com https://*.tiktok.com https://*.byteoversea.com https://api.open-meteo.com https://geocoding-api.open-meteo.com https://accounts.google.com https://www.googleapis.com https://oauth2.googleapis.com",
  "frame-src 'self' https://accounts.google.com",
].join("; ");

export function applySecurityHeaders(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  );
  if (!headers.has("Content-Security-Policy-Report-Only")) {
    headers.set("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY);
  }

  let host = "";
  try {
    host = new URL(request.url).hostname;
  } catch {
    host = "";
  }
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
