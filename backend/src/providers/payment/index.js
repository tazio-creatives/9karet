import { stubPaymentProvider } from './paymentProvider.stub.js';
import { cashfreePaymentProvider } from './paymentProvider.cashfree.js';
import { env } from '../../config/env.js';

const providers = {
  stub: stubPaymentProvider,
  cashfree: cashfreePaymentProvider,
};

export const paymentProvider = providers[env.paymentProvider];

if (!paymentProvider) {
  throw new Error(`Unknown PAYMENT_PROVIDER "${env.paymentProvider}"`);
}
