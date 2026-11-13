import { z } from 'zod';

const purposeSchema = z.enum(['LOGIN', 'SIGNUP', 'CHECKOUT', 'PHONE_CHANGE']);

export const otpSendSchema = z.object({
  mobile: z.string().min(1),
  purpose: purposeSchema,
});

export const otpVerifySchema = z.object({
  mobile: z.string().min(1),
  otp: z.string().length(6),
  purpose: purposeSchema,
});
