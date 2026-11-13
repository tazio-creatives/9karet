// Drops the date segment (BD-260810-4F2A9C -> BD-4F2A9C) for compact table
// display — callers that need the full id for traceability (audit, support)
// should keep using the raw orderNumber, e.g. via a title/tooltip.
export function shortOrderNumber(orderNumber: string): string {
  const parts = orderNumber.split('-');
  return parts.length === 3 ? `${parts[0]}-${parts[2]}` : orderNumber;
}
