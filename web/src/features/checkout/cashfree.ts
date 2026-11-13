import { load } from '@cashfreepayments/cashfree-js';

let cashfreePromise: ReturnType<typeof load> | null = null;

function getCashfree() {
  if (!cashfreePromise) {
    cashfreePromise = load({ mode: import.meta.env.VITE_CASHFREE_MODE ?? 'sandbox' });
  }
  return cashfreePromise;
}

// Launches Cashfree's Drop-in checkout in an embedded modal — the customer
// never leaves this page. Its own success/failure signal is never treated
// as the source of truth (a webhook is what actually confirms the order —
// see backend paymentService.confirmPayment); this only decides when to
// move on to the order confirmation page, which reflects whatever the
// backend actually knows.
export async function launchCashfreeCheckout(paymentSessionId: string): Promise<void> {
  const cashfree = await getCashfree();
  await cashfree.checkout({ paymentSessionId, redirectTarget: '_modal' });
}
