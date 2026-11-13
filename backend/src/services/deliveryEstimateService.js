// Single source of truth for the storefront's "estimated delivery" window
// (PLP cards, PDP, cart, checkout, and the order snapshot below) — every
// caller gets the same {earliestDate, latestDate} for the same India
// calendar day, computed here once rather than re-derived per surface.
//
// Calendar days, not business days: today's requirement is a flat 8-10 day
// window regardless of weekends/holidays. currentDate is normalized to its
// Asia/Kolkata calendar date (not the server's local/UTC date) before adding
// days, so a server running in UTC still adds from "today" as India sees it,
// including in the UTC 18:30-23:59 window where India's calendar date has
// already rolled over.

export const DEFAULT_MINIMUM_DAYS = 8;
export const DEFAULT_MAXIMUM_DAYS = 10;
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

function isValidTimezone(timezone) {
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

// en-CA gives a fixed, unambiguous yyyy-mm-dd layout — parsed back into
// numeric parts rather than trusting formatToParts' part order, which the
// spec doesn't guarantee to be en-CA's display order across all runtimes.
function getDateParts(date, timezone) {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const [year, month, day] = formatted.split('-').map(Number);
  return { year, month, day };
}

// Arithmetic done on a UTC-anchored Date purely as a calendar-day counter
// (no timezone attached to it at this point) — safe because Asia/Kolkata has
// no DST, so its calendar-day boundaries never shift relative to a fixed
// offset.
function addCalendarDays({ year, month, day }, days) {
  const anchor = new Date(Date.UTC(year, month - 1, day));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return { year: anchor.getUTCFullYear(), month: anchor.getUTCMonth() + 1, day: anchor.getUTCDate() };
}

function formatDateParts({ year, month, day }) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// calculateDeliveryEstimate({ currentDate, minimumDays, maximumDays, timezone })
// -> { minimumDays, maximumDays, earliestDate, latestDate, timezone }
//
// Every input is optional and independently validated — an invalid/missing
// value falls back to the documented default rather than throwing, so a
// malformed request never surfaces NaN/Invalid Date to a shopper (see the
// ERROR FALLBACK requirement this backs on the frontend).
export function calculateDeliveryEstimate(options = {}) {
  const { currentDate, minimumDays, maximumDays, timezone } = options;

  const safeTimezone = typeof timezone === 'string' && isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const safeMinimumDays = Number.isInteger(minimumDays) && minimumDays >= 0 ? minimumDays : DEFAULT_MINIMUM_DAYS;
  const safeMaximumDays =
    Number.isInteger(maximumDays) && maximumDays >= safeMinimumDays ? maximumDays : Math.max(DEFAULT_MAXIMUM_DAYS, safeMinimumDays);
  const safeCurrentDate = currentDate instanceof Date && !Number.isNaN(currentDate.getTime()) ? currentDate : new Date();

  const todayParts = getDateParts(safeCurrentDate, safeTimezone);

  return {
    minimumDays: safeMinimumDays,
    maximumDays: safeMaximumDays,
    earliestDate: formatDateParts(addCalendarDays(todayParts, safeMinimumDays)),
    latestDate: formatDateParts(addCalendarDays(todayParts, safeMaximumDays)),
    timezone: safeTimezone,
  };
}
