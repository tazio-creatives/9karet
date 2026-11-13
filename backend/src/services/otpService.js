import { env } from '../config/env.js';
import { normalizeMobile } from '../utils/mobile.js';
import { generateOtpCode, hashOtpCode, compareOtpCode } from '../utils/otp.js';
import { otpProvider } from '../providers/otp/index.js';
import { AppError, UnauthorizedError } from '../utils/AppError.js';
import {
  insertOtpVerification,
  findActiveOtpVerification,
  findLastOtpRequest,
  countOtpRequestsSince,
  incrementOtpAttempts,
  markOtpVerified,
} from '../repositories/otpVerifications.repository.js';
import {
  findUserByMobile,
  createUserByMobile,
  updateUserMobile,
} from '../repositories/users.repository.js';

async function assertNotThrottled(mobileNumber, purpose) {
  const last = await findLastOtpRequest(mobileNumber, purpose);
  if (last) {
    const secondsSinceLast = (Date.now() - new Date(last.created_at).getTime()) / 1000;
    if (secondsSinceLast < env.otpResendCooldownSeconds) {
      throw new AppError(429, 'Please wait before requesting another OTP');
    }
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const hourlyCount = await countOtpRequestsSince(mobileNumber, purpose, oneHourAgo);
  if (hourlyCount >= env.otpMaxRequestsPerHour) {
    throw new AppError(429, 'Too many OTP requests, please try again later');
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dailyCount = await countOtpRequestsSince(mobileNumber, purpose, oneDayAgo);
  if (dailyCount >= env.otpMaxRequestsPerDay) {
    throw new AppError(429, 'Too many OTP requests today, please try again tomorrow');
  }
}

export async function sendOtp(mobileInput, purpose) {
  const mobileNumber = normalizeMobile(mobileInput);
  await assertNotThrottled(mobileNumber, purpose);

  const code = generateOtpCode();
  const otpHash = await hashOtpCode(code);
  const expiresAt = new Date(Date.now() + env.otpExpiryMinutes * 60 * 1000);

  await insertOtpVerification({ mobileNumber, otpHash, purpose, expiresAt });
  await otpProvider.sendOTP(mobileNumber, code);

  return { mobile: mobileNumber };
}

// `authenticatedUserId` is only used for PHONE_CHANGE, where the caller must
// already be logged in as themselves — never exposed to unauthenticated callers.
export async function verifyOtp(mobileInput, code, purpose, { authenticatedUserId } = {}) {
  const mobileNumber = normalizeMobile(mobileInput);

  const otpRow = await findActiveOtpVerification(mobileNumber, purpose);
  if (!otpRow) {
    throw new AppError(400, 'OTP expired or not found — please request a new one');
  }
  if (otpRow.attempts >= env.otpMaxVerifyAttempts) {
    throw new AppError(429, 'Too many incorrect attempts — please request a new OTP');
  }

  const matches = await compareOtpCode(code, otpRow.otp_hash);
  if (!matches) {
    await incrementOtpAttempts(otpRow.id);
    throw new AppError(400, 'Incorrect OTP');
  }

  await markOtpVerified(otpRow.id);

  if (purpose === 'PHONE_CHANGE') {
    if (!authenticatedUserId) {
      throw new UnauthorizedError('Must be logged in to change mobile number');
    }
    const user = await updateUserMobile(authenticatedUserId, mobileNumber);
    return { verified: true, purpose, user, isNewUser: false };
  }

  let user = await findUserByMobile(mobileNumber);
  const isNewUser = !user;
  if (!user) {
    user = await createUserByMobile(mobileNumber);
  }

  return { verified: true, purpose, user, isNewUser };
}
