import { Router } from 'express';
import { send, verify } from '../controllers/otp.controller.js';
import { otpSendRateLimiter } from '../middleware/rateLimit.js';

export const otpRouter = Router();

otpRouter.post('/send', otpSendRateLimiter, send);
otpRouter.post('/verify', verify);
