import { query } from '../config/db.js';

export async function insertOtpVerification({ mobileNumber, otpHash, purpose, expiresAt }) {
  const { rows } = await query(
    `INSERT INTO otp_verifications (mobile_number, otp_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [mobileNumber, otpHash, purpose, expiresAt],
  );
  return rows[0].id;
}

// Most recent, still-usable (not expired, not verified) row for this mobile+purpose.
export async function findActiveOtpVerification(mobileNumber, purpose) {
  const { rows } = await query(
    `SELECT id, otp_hash, attempts, expires_at
     FROM otp_verifications
     WHERE mobile_number = $1 AND purpose = $2
       AND verified_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC
     LIMIT 1`,
    [mobileNumber, purpose],
  );
  return rows[0] ?? null;
}

export async function findLastOtpRequest(mobileNumber, purpose) {
  const { rows } = await query(
    `SELECT created_at FROM otp_verifications
     WHERE mobile_number = $1 AND purpose = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [mobileNumber, purpose],
  );
  return rows[0] ?? null;
}

export async function countOtpRequestsSince(mobileNumber, purpose, since) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM otp_verifications
     WHERE mobile_number = $1 AND purpose = $2 AND created_at > $3`,
    [mobileNumber, purpose, since],
  );
  return rows[0].count;
}

export async function incrementOtpAttempts(id) {
  await query('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1', [id]);
}

export async function markOtpVerified(id) {
  await query('UPDATE otp_verifications SET verified_at = now() WHERE id = $1', [id]);
}
