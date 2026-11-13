import { AppError } from './AppError.js';

// Normalizes to +91XXXXXXXXXX (plan §10: default country code +91, stored in
// normalized international format). Accepts "9876543210", "919876543210",
// "+919876543210" — anything else is rejected rather than guessed at.
export function normalizeMobile(input) {
  const digits = String(input ?? '').replace(/[^\d]/g, '');

  let tenDigits;
  if (digits.length === 10) {
    tenDigits = digits;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    tenDigits = digits.slice(2);
  } else {
    throw new AppError(400, 'Enter a valid 10-digit mobile number');
  }

  if (!/^[6-9]\d{9}$/.test(tenDigits)) {
    throw new AppError(400, 'Enter a valid 10-digit mobile number');
  }

  return `+91${tenDigits}`;
}
