// Single formatting utility for the "estimated delivery" window returned by
// the backend's calculateDeliveryEstimate() (see products/orders/cart
// responses) — every surface (PLP, PDP, cart, checkout, order pages) reads
// this instead of re-deriving month/year-boundary display rules itself.
// This file only formats already-computed ISO dates; it never invents or
// adjusts a delivery window on its own.

export interface DeliveryEstimate {
  minimumDays: number;
  maximumDays: number;
  // YYYY-MM-DD, Asia/Kolkata calendar date — date-only, no time component.
  earliestDate: string;
  latestDate: string;
  timezone: string;
}

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface DateParts {
  year: number;
  month: number;
  day: number;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Deliberately not `new Date(iso)` — that parses as UTC midnight, and
// formatting it back out through the *browser's* local timezone can shift
// the displayed day by one, exactly the bug this whole feature exists to
// avoid. Parsing the Y-M-D digits directly sidesteps timezones entirely.
function parseIsoDate(iso: string | null | undefined): DateParts | null {
  if (!iso) return null;
  const match = ISO_DATE_PATTERN.exec(iso);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export type DeliveryRangeStyle = 'full' | 'compact';

// "17–19 September" / "17–19 Sep" (same month), "29 September–1 October"
// (different month, same year), "28 December 2026–2 January 2027"
// (different year). Returns null on unparseable input so callers can fall
// back to the fixed "in N–M days" copy instead of ever rendering a broken
// or ambiguous string.
export function formatDeliveryRange(
  earliestDate: string | null | undefined,
  latestDate: string | null | undefined,
  style: DeliveryRangeStyle = 'full',
): string | null {
  const start = parseIsoDate(earliestDate);
  const end = parseIsoDate(latestDate);
  if (!start || !end) return null;

  const months = style === 'compact' ? MONTH_NAMES_SHORT : MONTH_NAMES_FULL;
  const sameYear = start.year === end.year;
  const sameMonth = sameYear && start.month === end.month;

  if (sameMonth) {
    return `${start.day}–${end.day} ${months[end.month - 1]}`;
  }
  if (sameYear) {
    return `${start.day} ${months[start.month - 1]}–${end.day} ${months[end.month - 1]}`;
  }
  return `${start.day} ${months[start.month - 1]} ${start.year}–${end.day} ${months[end.month - 1]} ${end.year}`;
}

export const DEFAULT_DELIVERY_MINIMUM_DAYS = 8;
export const DEFAULT_DELIVERY_MAXIMUM_DAYS = 10;

// Used whenever the API didn't return a usable estimate (missing, or dates
// that fail to parse) — never render NaN/Invalid Date, and never block
// Add to Cart/Buy Now on it.
export function deliveryFallbackDaysText(estimate: DeliveryEstimate | null | undefined): string {
  const min = estimate?.minimumDays ?? DEFAULT_DELIVERY_MINIMUM_DAYS;
  const max = estimate?.maximumDays ?? DEFAULT_DELIVERY_MAXIMUM_DAYS;
  return `${min}–${max} days`;
}
