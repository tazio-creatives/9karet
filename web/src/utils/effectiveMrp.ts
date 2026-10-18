// Two independent things can make a product's charged price lower than its
// "full" price: an admin-set MRP (a static, manually entered reference
// price) and a live making-charge/gemstone offer (`sellingPriceOriginal`,
// recomputed from the current gold rate every time). Either can be the
// higher, more truthful "was" price to strike through — this picks whichever
// one is actually higher than the current sellingPrice, so the % shown
// always matches the strikethrough number next to it.
export function effectiveMrp(
  sellingPrice: number,
  mrp: number,
  sellingPriceOriginal: number,
): { strikePrice: number; discountPercent: number } {
  const strikePrice = Math.max(mrp, sellingPriceOriginal);
  if (strikePrice <= sellingPrice) return { strikePrice: 0, discountPercent: 0 };
  return { strikePrice, discountPercent: Math.round(((strikePrice - sellingPrice) / strikePrice) * 100) };
}
