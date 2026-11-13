// Product SEO wording built only from a product's real attributes — never
// generic keyword lists. A gemstone is named only for pieces that actually
// carry that stone.

interface ProductAttrs {
  name: string;
  purity?: string | null;
  goldColor?: 'YELLOW' | 'ROSE' | 'WHITE' | null;
  // Detail pages know the exact stones; listing cards only the total weight.
  stones?: { stoneTypeName: string }[] | null;
  stoneWeightCarats?: number | null;
}

// Top-level category name -> singular jewellery type. Categories that aren't
// a jewellery type (Gents, Kids, Gifting…) return null and are left out.
const JEWELLERY_TYPES: Record<string, string> = {
  rings: 'Ring',
  ring: 'Ring',
  earrings: 'Earrings',
  earring: 'Earrings',
  necklaces: 'Necklace',
  necklace: 'Necklace',
  pendants: 'Pendant',
  pendant: 'Pendant',
  bangles: 'Bangle',
  bangle: 'Bangle',
  bracelets: 'Bracelet',
  bracelet: 'Bracelet',
};

export function jewelleryType(rootCategoryName: string | null | undefined): string | null {
  return rootCategoryName ? (JEWELLERY_TYPES[rootCategoryName.trim().toLowerCase()] ?? null) : null;
}

export function hasStones(p: ProductAttrs): boolean {
  return (p.stones?.length ?? 0) > 0 || (p.stoneWeightCarats ?? 0) > 0;
}

// "ruby" / "ruby and emerald" when the stones are known, else "gemstone".
function stoneWords(p: ProductAttrs): string | null {
  if (!hasStones(p)) return null;
  const names = [...new Set((p.stones ?? []).map((s) => s.stoneTypeName.toLowerCase()))];
  if (names.length === 0 || names.length > 2) return 'gemstone';
  return names.join(' and ');
}

// "9K yellow gold"
export function metalLabel(p: ProductAttrs): string {
  const colour = p.goldColor ? p.goldColor.toLowerCase() : null;
  return [p.purity ?? '9K', colour, 'gold'].filter(Boolean).join(' ');
}

// "Ruby Halo Ring | 9K Gold Ruby Ring | 9KARET"
export function productSeoTitle(p: ProductAttrs, type: string | null): string {
  const stones = stoneWords(p);
  if (!type) return `${p.name} | 9KARET`;
  const kind = stones ? `${stones.replace(/\b\w/g, (c) => c.toUpperCase())} ${type}` : type;
  return `${p.name} | 9K Gold ${kind} | 9KARET`;
}

// Only used when the product has no meta description or short description.
export function productSeoDescription(p: ProductAttrs, type: string | null): string {
  const stones = stoneWords(p);
  const what = [stones, type ? type.toLowerCase() : 'jewellery'].filter(Boolean).join(' ');
  return `${p.name} — a ${what} in ${metalLabel(p)}. Shop BIS hallmarked 9K gold jewellery online at 9KARET.`;
}

// "Ruby Halo Ring, ruby ring in 9K yellow gold"
export function productImageAlt(p: ProductAttrs, type?: string | null): string {
  const stones = stoneWords(p);
  const kind = type ? [stones, type.toLowerCase()].filter(Boolean).join(' ') : null;
  if (kind) return `${p.name}, ${kind} in ${metalLabel(p)}`;
  return `${p.name} in ${metalLabel(p)}`;
}
