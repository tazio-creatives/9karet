import * as paymentService from '../services/paymentService.js';

// req.body is a raw Buffer here (express.raw(), mounted before the global
// express.json() — see app.js) so the signature covers the exact bytes the
// provider signed, not a re-serialized re-parse of them.
export async function webhook(req, res, next) {
  try {
    const rawBody = req.body.toString('utf-8');
    const result = await paymentService.confirmPayment(rawBody, req.headers);
    res.status(200).json({ received: true, alreadyProcessed: result.alreadyProcessed });
  } catch (err) {
    next(err);
  }
}
