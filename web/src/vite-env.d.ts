/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_CASHFREE_MODE?: 'sandbox' | 'production';
  readonly VITE_TAWK_EMBED_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  // Injected by web/server as an inline <script> before entry-client.tsx
  // runs (plan §1a) — the dehydrated TanStack Query cache from SSR.
  __REACT_QUERY_STATE__?: unknown;
}

// @cashfreepayments/cashfree-js ships no type declarations of its own —
// this covers only the surface this app actually calls (checkout.ts).
declare module '@cashfreepayments/cashfree-js' {
  interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    redirectTarget?: '_self' | '_blank' | '_modal' | HTMLElement;
  }

  interface CashfreeCheckoutResult {
    error?: { message: string };
    redirect?: boolean;
    paymentDetails?: { paymentMessage: string };
  }

  interface Cashfree {
    checkout(_options: CashfreeCheckoutOptions): Promise<CashfreeCheckoutResult>;
  }

  export function load(_options: { mode: 'sandbox' | 'production' }): Promise<Cashfree>;
}
