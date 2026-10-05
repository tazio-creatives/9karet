import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const apiRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMinutes * 60 * 1000,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for the admin login endpoint specifically — brute-force
// protection independent of general API traffic. See plan §8/§29.
export const adminLoginRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMinutes * 60 * 1000,
  max: env.adminLoginRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many login attempts, try again later' } },
});

// Per-IP throttle on OTP send, on top of the per-mobile throttling inside
// OTPService — catches one IP hammering many different mobile numbers
// (plan §12: "per-IP/device throttling where appropriate").
export const otpSendRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMinutes * 60 * 1000,
  max: env.otpSendRateLimitPerIp,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many OTP requests from this network, try again later' } },
});

// "Refresh Rate" in the admin Pricing page calls OroPocket's public endpoint
// (their own limit: 10 req/60s per IP) — this keeps repeated admin clicks
// from ever approaching that, independent of general admin traffic.
// Public Contact Us form — a handful of messages per network per hour is
// plenty for a real customer and stops scripted flooding of the inbox.
export const contactRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many messages sent from this network. Please try again later or email us directly.' } },
});

// Public pincode delivery check — each uncached pincode is a live Delhivery
// API call, so this caps how fast one network can probe new pincodes.
export const pincodeCheckRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many pincode checks, please try again in a few minutes.' } },
});

export const goldRateSyncRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many gold rate refresh requests, try again shortly' } },
});

// AI Image Studio's upload/analyse, confirm-and-generate and per-asset retry
// endpoints each trigger a real, billed OpenAI call — stricter than general
// admin traffic so a stuck frontend retry loop can't run up API spend.
export const aiStudioRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMinutes * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many AI Image Studio requests, try again later' } },
});
