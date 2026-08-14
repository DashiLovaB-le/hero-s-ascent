import { timingSafeEqual } from "node:crypto";

/** Compara secrets em tempo constante. Tamanhos diferentes → false (sem throw). */
export function secretsEqual(expected: string, provided: string): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
