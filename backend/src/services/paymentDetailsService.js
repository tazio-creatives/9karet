import { paymentProvider } from '../providers/payment/index.js';
import { findPaymentByOrderId, savePaymentDetails } from '../repositories/payments.repository.js';

// Payment identifiers shown in admin so a refund can be issued from the
// Cashfree dashboard: the Cashfree order ID (our order number) plus the
// transaction ID / bank reference. Saved from the payment webhook; for
// older orders fetched once from Cashfree and stored.
export async function getPaymentDetailsForOrder(order) {
  if (!['PAID', 'REFUNDED'].includes(order.payment_status)) return null;
  const payment = await findPaymentByOrderId(order.id);
  if (!payment) return null;

  const base = { provider: payment.provider, gatewayOrderId: payment.provider_ref, amount: Number(payment.amount) };
  let details = payment.raw_payload?.details ?? null;

  if (!details?.transactionId && typeof paymentProvider.fetchPaymentDetails === 'function') {
    try {
      details = await paymentProvider.fetchPaymentDetails(payment.provider_ref);
      if (details?.transactionId) await savePaymentDetails(payment.id, details);
    } catch (err) {
      console.error(`Payment details lookup failed for order ${order.order_number}:`, err.message);
      return { ...base, transactionId: null, lookupFailed: true };
    }
  }

  return {
    ...base,
    transactionId: details?.transactionId ?? null,
    bankReference: details?.bankReference ?? null,
    paymentMethod: details?.paymentMethod ?? null,
    paymentTime: details?.paymentTime ?? null,
    lookupFailed: false,
  };
}
