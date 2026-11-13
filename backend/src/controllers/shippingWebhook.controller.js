import * as shippingService from '../services/shippingService.js';

// req.body is a raw Buffer here (express.raw(), mounted before the global
// express.json() — see app.js), same discipline as paymentWebhook.controller.js.
export async function webhook(req, res, next) {
  try {
    const rawBody = req.body.toString('utf-8');
    const signature = req.get('X-Shipping-Signature');
    const result = await shippingService.confirmTrackingUpdate(rawBody, signature);
    res.status(200).json({ received: true, alreadyProcessed: result.alreadyProcessed });
  } catch (err) {
    next(err);
  }
}
