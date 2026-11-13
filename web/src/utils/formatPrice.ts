// Indian ecommerce convention: whole-rupee amounts, no decimals (e.g.
// "₹42,154", not "₹42,153.5").
export function formatPrice(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}
