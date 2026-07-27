/**
 * Capítulos da Jornada (xp_minimo alinhado ao seed em complete_schema).
 * Independente dos títulos de LEVELS — capítulo = arco narrativo por XP total.
 */
export const CHAPTERS = [
  { numero: 1, nome: "O Chamado", xp_minimo: 0 },
  { numero: 2, nome: "A Travessia", xp_minimo: 500 },
  { numero: 3, nome: "As Provas", xp_minimo: 2000 },
  { numero: 4, nome: "O Abismo", xp_minimo: 6000 },
  { numero: 5, nome: "A Recompensa", xp_minimo: 15000 },
  { numero: 6, nome: "O Retorno", xp_minimo: 35000 },
  { numero: 7, nome: "A Lenda", xp_minimo: 70000 },
] as const;

export function resolveChapter(xpTotal: number): number {
  let n = 1;
  for (const c of CHAPTERS) {
    if (xpTotal >= c.xp_minimo) n = c.numero;
  }
  return n;
}

export function chapterName(n: number): string {
  return CHAPTERS.find((c) => c.numero === n)?.nome ?? "O Chamado";
}

/** Rotas permitidas sem onboarding completo. */
export const ONBOARDING_ALLOWED_PATHS = ["/onboarding", "/profile"] as const;

export function isOnboardingAllowedPath(pathname: string): boolean {
  return ONBOARDING_ALLOWED_PATHS.some(
    (p) => pathname === p || pathname.endsWith(p),
  );
}
