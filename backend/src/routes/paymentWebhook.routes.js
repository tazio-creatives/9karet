import { Router } from 'express';
import express from 'express';
import { webhook } from '../controllers/paymentWebhook.controller.js';

// Mounted at /api/v1/payments/webhook, BEFORE the global express.json() in
// app.js — express.raw() here is what preserves the exact byte sequence
// the HMAC signature was computed over.
export const paymentWebhookRouter = Router();

paymentWebhookRouter.post('/webhook', express.raw({ type: 'application/json' }), webhook);
