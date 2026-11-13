// Mirrors the stock copy/thresholds already used on the PDP
// (features/pdp/ProductInfo.tsx) and the old ProductCard's LOW_STOCK_THRESHOLD,
// as a single source for the new compact PLP card's badge + stock/delivery row.
const LOW_STOCK_THRESHOLD = 3;

export type StockState = 'in' | 'low' | 'out';

export interface StockStatus {
  state: StockState;
  label: string;
  deliveryText: string;
}

export function getStockStatus(availableStock: number): StockStatus {
  if (availableStock <= 0) {
    return { state: 'out', label: 'Make to Order', deliveryText: 'Ships in 7–10 working days' };
  }
  if (availableStock <= LOW_STOCK_THRESHOLD) {
    return { state: 'low', label: `Only ${availableStock} left`, deliveryText: 'Delivery in 5 days' };
  }
  return { state: 'in', label: 'In Stock', deliveryText: 'Delivery in 5 days' };
}
