/**
 * Após um deploy no Vercel, abas antigas ainda têm o JS antigo em memória
 * e tentam importar chunks com hash que já não existem (404).
 * Detecta isso e força um reload único.
 */

const FLAG = "v-chunk-reload";

export function isChunkLoadError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : String(error ?? "");
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
}

/** Retorna true se disparou reload (a página vai reiniciar). */
export function reloadOnceOnChunkError(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (!isChunkLoadError(error)) return false;

  try {
    const last = sessionStorage.getItem(FLAG);
    const now = Date.now();
    // Evita loop se o reload não resolver (ex.: rede)
    if (last && now - Number(last) < 15_000) return false;
    sessionStorage.setItem(FLAG, String(now));
  } catch {
    /* private mode */
  }

  window.location.reload();
  return true;
}

/** Escuta rejeições de dynamic import em abas abertas após deploy. */
export function installChunkLoadRecovery() {
  if (typeof window === "undefined") return () => {};

  const onRejection = (event: PromiseRejectionEvent) => {
    if (reloadOnceOnChunkError(event.reason)) {
      event.preventDefault();
    }
  };

  const onError = (event: ErrorEvent) => {
    reloadOnceOnChunkError(event.error ?? event.message);
  };

  window.addEventListener("unhandledrejection", onRejection);
  window.addEventListener("error", onError);
  return () => {
    window.removeEventListener("unhandledrejection", onRejection);
    window.removeEventListener("error", onError);
  };
}
