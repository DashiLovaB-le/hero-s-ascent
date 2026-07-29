import { calcularNivel } from "@/lib/journey";

/**
 * Wallpapers do V-Project.
 * Imagens: public/wallpapers/<arquivo>
 * Coloque os arquivos com exatamente estes nomes (jpg, png ou webp — use o nome do campo `file`).
 */

export type WallpaperUnlock =
  | { kind: "always" }
  | { kind: "level"; min: number }
  | { kind: "streak_max"; min: number }
  | { kind: "chapter"; min: number }
  | { kind: "xp"; min: number };

export type WallpaperDef = {
  id: string;
  /** Nome do arquivo em /public/wallpapers/ — ex: "02-aprendiz.jpg" */
  file: string | null;
  /** URL absoluta (Storage) — tem prioridade sobre `file` quando presente. */
  imageUrl?: string | null;
  titulo: string;
  descricao: string;
  unlock: WallpaperUnlock;
};

/** `none` = fundo padrão do app (sem imagem). */
export const WALLPAPERS: WallpaperDef[] = [
  {
    id: "none",
    file: null,
    titulo: "Escuridão Original",
    descricao: "O fundo padrão do V-Project.",
    unlock: { kind: "always" },
  },
  {
    id: "chamado",
    file: "01-chamado.jpg",
    titulo: "O Chamado",
    descricao: "Desbloqueado ao iniciar a jornada.",
    unlock: { kind: "always" },
  },
  {
    id: "aprendiz",
    file: "02-aprendiz.jpg",
    titulo: "Aprendiz",
    descricao: "Alcance o nível 2 — Aprendiz.",
    unlock: { kind: "level", min: 2 },
  },
  {
    id: "iniciado",
    file: "03-iniciado.jpg",
    titulo: "Iniciado",
    descricao: "Alcance o nível 3 — Iniciado.",
    unlock: { kind: "level", min: 3 },
  },
  {
    id: "aspirante",
    file: "04-aspirante.jpg",
    titulo: "Aspirante",
    descricao: "Alcance o nível 4 — Aspirante.",
    unlock: { kind: "level", min: 4 },
  },
  {
    id: "guerreiro",
    file: "05-guerreiro.jpg",
    titulo: "Guerreiro",
    descricao: "Alcance o nível 5 — Guerreiro.",
    unlock: { kind: "level", min: 5 },
  },
  {
    id: "sentinela",
    file: "06-sentinela.jpg",
    titulo: "Sentinela",
    descricao: "Alcance o nível 6 — Sentinela.",
    unlock: { kind: "level", min: 6 },
  },
  {
    id: "cavaleiro",
    file: "07-cavaleiro.jpg",
    titulo: "Cavaleiro",
    descricao: "Alcance o nível 7 — Cavaleiro.",
    unlock: { kind: "level", min: 7 },
  },
  {
    id: "estrategista",
    file: "08-estrategista.jpg",
    titulo: "Estrategista",
    descricao: "Alcance o nível 8 — Estrategista.",
    unlock: { kind: "level", min: 8 },
  },
  {
    id: "mestre",
    file: "09-mestre.jpg",
    titulo: "Mestre",
    descricao: "Alcance o nível 9 — Mestre.",
    unlock: { kind: "level", min: 9 },
  },
  {
    id: "sabio",
    file: "10-sabio.jpg",
    titulo: "Sábio",
    descricao: "Alcance o nível 10 — Sábio.",
    unlock: { kind: "level", min: 10 },
  },
  {
    id: "rei",
    file: "11-rei.jpg",
    titulo: "Rei",
    descricao: "Alcance o nível 11 — Rei.",
    unlock: { kind: "level", min: 11 },
  },
  {
    id: "lenda",
    file: "12-lenda.jpg",
    titulo: "Lenda",
    descricao: "Alcance o nível 12 — Lenda.",
    unlock: { kind: "level", min: 12 },
  },
  {
    id: "fogo-7",
    file: "13-fogo-7.jpg",
    titulo: "Chama de 7 Dias",
    descricao: "Mantenha streak máximo de 7 dias.",
    unlock: { kind: "streak_max", min: 7 },
  },
  {
    id: "fogo-30",
    file: "14-fogo.jpg",
    titulo: "Chama de 30 Dias",
    descricao: "Mantenha streak máximo de 30 dias.",
    unlock: { kind: "streak_max", min: 30 },
  },
  {
    id: "provas",
    file: "15-provas.jpg",
    titulo: "As Provas",
    descricao: "Chegue ao capítulo 3 ou superior.",
    unlock: { kind: "chapter", min: 3 },
  },
  {
    id: "abismo",
    file: "16-abismo.jpg",
    titulo: "O Abismo",
    descricao: "Chegue ao capítulo 5 ou superior.",
    unlock: { kind: "chapter", min: 5 },
  },
];

export const DEFAULT_WALLPAPER_ID = "none";

export type WallpaperProgress = {
  xp_total: number;
  streak_maximo: number;
  capitulo_atual: number;
};

export function wallpaperSrc(def: WallpaperDef | string | null): string | null {
  if (def == null) return null;
  if (typeof def === "string") {
    if (!def) return null;
    if (def.startsWith("http://") || def.startsWith("https://") || def.startsWith("/")) return def;
    return `/wallpapers/${def}`;
  }
  if (def.imageUrl) return def.imageUrl;
  if (!def.file) return null;
  if (def.file.startsWith("http://") || def.file.startsWith("https://") || def.file.startsWith("/")) {
    return def.file;
  }
  return `/wallpapers/${def.file}`;
}

/** Catálogo estático de fallback (quando DB indisponível). */
export const WALLPAPERS_FALLBACK = WALLPAPERS;

let runtimeCatalog: WallpaperDef[] | null = null;

/** Injeta catálogo do DB (client/server) para getWallpaperById / resolve. */
export function setWallpaperCatalog(list: WallpaperDef[] | null | undefined) {
  runtimeCatalog = list?.length ? list : null;
}

function catalog(): WallpaperDef[] {
  return runtimeCatalog ?? WALLPAPERS;
}

export function getWallpaperById(id: string | null | undefined): WallpaperDef {
  const list = catalog();
  return list.find((w) => w.id === id) ?? list[0] ?? WALLPAPERS[0];
}

export const WALLPAPER_IDS = () => catalog().map((w) => w.id);

export function isWallpaperUnlocked(
  def: WallpaperDef,
  progress: WallpaperProgress,
  levels?: import("@/lib/journey").LevelInfo[],
): boolean {
  const nivel = calcularNivel(progress.xp_total, levels).atual.nivel;
  switch (def.unlock.kind) {
    case "always":
      return true;
    case "level":
      return nivel >= def.unlock.min;
    case "streak_max":
      return progress.streak_maximo >= def.unlock.min;
    case "chapter":
      return progress.capitulo_atual >= def.unlock.min;
    case "xp":
      return progress.xp_total >= def.unlock.min;
    default:
      return false;
  }
}

export function unlockHint(def: WallpaperDef): string {
  switch (def.unlock.kind) {
    case "always":
      return "Disponível";
    case "level":
      return `Nível ${def.unlock.min}+`;
    case "streak_max":
      return `Streak máx. ${def.unlock.min}+`;
    case "chapter":
      return `Capítulo ${def.unlock.min}+`;
    case "xp":
      return `${def.unlock.min.toLocaleString("pt-BR")} XP`;
    default:
      return "Bloqueado";
  }
}

/** Fundos que passaram de bloqueados → liberados entre dois estados de progresso. */
export function getNewlyUnlockedWallpapers(
  before: WallpaperProgress,
  after: WallpaperProgress,
): WallpaperDef[] {
  return catalog().filter(
    (w) =>
      w.unlock.kind !== "always" &&
      !isWallpaperUnlocked(w, before) &&
      isWallpaperUnlocked(w, after),
  );
}

export function lockedWallpaperMessage(def: WallpaperDef): string {
  switch (def.unlock.kind) {
    case "level":
      return `Ainda não. Alcance o nível ${def.unlock.min} para liberar “${def.titulo}”.`;
    case "streak_max":
      return `Ainda não. Construa um streak máximo de ${def.unlock.min} dias para liberar “${def.titulo}”.`;
    case "chapter":
      return `Ainda não. Chegue ao capítulo ${def.unlock.min} para liberar “${def.titulo}”.`;
    case "xp":
      return `Ainda não. Acumule ${def.unlock.min.toLocaleString("pt-BR")} XP para liberar “${def.titulo}”.`;
    default:
      return `“${def.titulo}” ainda está bloqueado. Continue a jornada.`;
  }
}
