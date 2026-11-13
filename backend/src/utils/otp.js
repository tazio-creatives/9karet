import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

// crypto.randomInt is CSPRNG-backed (plan §12: "6-digit random OTP").
export function generateOtpCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashOtpCode(code) {
  return bcrypt.hash(code, 10);
}

export function compareOtpCode(code, hash) {
  return bcrypt.compare(code, hash);
}
