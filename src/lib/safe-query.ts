/** Garante que rejeições de server fn nunca cheguem ao React como `undefined`. */
export function asQueryError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string" && error.trim()) return new Error(error);
  if (error != null && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return new Error(msg);
  }
  return new Error(fallback);
}

export async function runQueryFn<T>(fn: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw asQueryError(error, fallback);
  }
}
