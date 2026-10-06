// Product SEO wording built only from a product's real attributes — never
// generic keyword lists. "Natural diamond" is said only for pieces that
// actually carry diamond details (colour, clarity or weight).

interface ProductAttrs {
  name: string;
  metalType?: 'GOLD' | 'PLATINUM' | null;
  purity?: string | null;
  goldColor?: 'YELLOW' | 'ROSE' | 'WHITE' | null;
  diamondColour?: string | null;
  diamondClarity?: string | null;
  diamondWeightCarats?: number | null;
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

export function hasDiamonds(p: ProductAttrs): boolean {
  return !!(p.diamondColour || p.diamondClarity || (p.diamondWeightCarats ?? 0) > 0);
}

// "9K yellow gold" / "platinum"
export function metalLabel(p: ProductAttrs): string | null {
  if (p.metalType === 'PLATINUM') return 'platinum';
  const colour = p.goldColor ? p.goldColor.toLowerCase() : null;
  const parts = [p.purity, colour, 'gold'].filter(Boolean);
  return p.purity || colour ? parts.join(' ') : null;
}

// "Teresa Diamond Oval Bangle | Natural Diamond Bangle | BOX DIAMONDS"
export function productSeoTitle(p: ProductAttrs, type: string | null): string {
  return type && hasDiamonds(p) ? `${p.name} | Natural Diamond ${type} | BOX DIAMONDS` : `${p.name} | BOX DIAMONDS`;
}

// Only used when the product has no meta description or short description.
export function productSeoDescription(p: ProductAttrs, type: string | null): string {
  const metal = metalLabel(p);
  const what = [hasDiamonds(p) ? 'natural diamond' : null, type ? type.toLowerCase() : 'jewellery']
    .filter(Boolean)
    .join(' ');
  return `${p.name} — a ${what}${metal ? ` in ${metal}` : ''}. Shop certified diamond jewellery online at BOX DIAMONDS.`;
}

// "Teresa Diamond Oval Bangle, natural diamond bangle in 9K yellow gold"
export function productImageAlt(p: ProductAttrs, type?: string | null): string {
  const metal = metalLabel(p);
  const kind = hasDiamonds(p) && type ? `natural diamond ${type.toLowerCase()}` : null;
  if (kind) return `${p.name}, ${kind}${metal ? ` in ${metal}` : ''}`;
  return metal ? `${p.name} in ${metal}` : p.name;
}
