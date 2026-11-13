import { apiFetch } from './client';
import type { Customer } from './types';

export type OtpPurpose = 'LOGIN' | 'SIGNUP' | 'CHECKOUT' | 'PHONE_CHANGE';

export function sendOtp(mobile: string, purpose: OtpPurpose = 'LOGIN') {
  return apiFetch<{ message: string }>('/otp/send', {
    method: 'POST',
    body: JSON.stringify({ mobile, purpose }),
  });
}

export function verifyOtp(mobile: string, otp: string, purpose: OtpPurpose = 'LOGIN') {
  return apiFetch<{ verified: boolean; isNewUser: boolean; user: Customer }>('/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ mobile, otp, purpose }),
  });
}
