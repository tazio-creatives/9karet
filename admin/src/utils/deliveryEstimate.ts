// Mirrors web/src/utils/deliveryEstimate.ts — same formatting rules for the
// order snapshot frozen at checkout (backend/src/services/
// deliveryEstimateService.js), just for the admin order detail screen.
// Admin never recalculates this; it only formats the ISO dates the backend
// already stored on the order.

import type { DeliveryEstimate } from '../api/types';

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface DateParts {
  year: number;
  month: number;
  day: number;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(iso: string | null | undefined): DateParts | null {
  if (!iso) return null;
  const match = ISO_DATE_PATTERN.exec(iso);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function formatDeliveryRange(earliestDate: string | null | undefined, latestDate: string | null | undefined): string | null {
  const start = parseIsoDate(earliestDate);
  const end = parseIsoDate(latestDate);
  if (!start || !end) return null;

  const sameYear = start.year === end.year;
  const sameMonth = sameYear && start.month === end.month;

  if (sameMonth) return `${start.day}–${end.day} ${MONTH_NAMES_FULL[end.month - 1]}`;
  if (sameYear) return `${start.day} ${MONTH_NAMES_FULL[start.month - 1]}–${end.day} ${MONTH_NAMES_FULL[end.month - 1]}`;
  return `${start.day} ${MONTH_NAMES_FULL[start.month - 1]} ${start.year}–${end.day} ${MONTH_NAMES_FULL[end.month - 1]} ${end.year}`;
}

export function deliveryFallbackDaysText(estimate: DeliveryEstimate | null | undefined): string {
  return `${estimate?.minimumDays ?? 8}–${estimate?.maximumDays ?? 10} days`;
}
