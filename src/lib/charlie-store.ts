/**
 * Catálogo visual da loja de personalidades do Charlie.
 * Pagamento / inventário entram depois — por ora só mapeia arte + preço display.
 */

export const CHARLIE_STORE_IMAGE_BY_SLUG: Record<string, string> = {
  classico: "/charlie-versions/charlie-classico.png",
  militar: "/charlie-versions/charlie-militar.png",
  estoico: "/charlie-versions/charlie-estoico.png",
  empresarial: "/charlie-versions/charlie-empresarial.png",
  cristao: "/charlie-versions/charlie-cristao.png",
  fitness: "/charlie-versions/charlie-fitness.png",
  financeiro: "/charlie-versions/charlie-financeiro.png",
};

export const CHARLIE_STORE_FALLBACK_IMAGE = "/charlie.png";

/** Preço de vitrine — grátis até a camada de pagamento. */
export function charlieStorePriceLabel(_slug: string): string {
  return "Grátis";
}

export function charlieStoreImage(slug: string): string {
  return CHARLIE_STORE_IMAGE_BY_SLUG[slug] ?? CHARLIE_STORE_FALLBACK_IMAGE;
}
