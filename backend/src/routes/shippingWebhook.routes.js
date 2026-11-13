import { Router } from 'express';
import express from 'express';
import { webhook } from '../controllers/shippingWebhook.controller.js';

// Mounted at /api/v1/shipping/webhook, BEFORE the global express.json() in
// app.js — same reasoning as paymentWebhook.routes.js.
export const shippingWebhookRouter = Router();

shippingWebhookRouter.post('/webhook', express.raw({ type: 'application/json' }), webhook);
