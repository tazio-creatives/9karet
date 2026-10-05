import { useEffect } from 'react';
import { useCustomer } from '../auth/useCustomer';

// Tawk.to live chat (third-party; may be replaced by an in-house chatbot
// later). Shown only on pages that call useTawkChat() — My Orders and the
// order detail page — and hidden again when the customer navigates away.
// Unset VITE_TAWK_EMBED_URL to switch it off entirely.
const EMBED_URL = import.meta.env.VITE_TAWK_EMBED_URL;

/* eslint-disable @typescript-eslint/no-explicit-any */
type TawkApi = Record<string, any>;

declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Calls made before the widget finishes loading are queued and replayed in
// order on load, so a quick show -> hide (fast navigation) still ends hidden.
let isReady = false;
let pending: ((_api: TawkApi) => void)[] = [];

function whenReady(fn: (_api: TawkApi) => void) {
  const api = window.Tawk_API;
  if (isReady && api) fn(api);
  else pending.push(fn);
}

function loadOnce() {
  if (!EMBED_URL || document.getElementById('tawk-script')) return;
  const api: TawkApi = (window.Tawk_API = window.Tawk_API || {});
  window.Tawk_LoadStart = new Date();
  api.onLoad = () => {
    isReady = true;
    const queued = pending;
    pending = [];
    queued.forEach((fn) => fn(api));
  };
  const script = document.createElement('script');
  script.id = 'tawk-script';
  script.async = true;
  script.src = EMBED_URL;
  script.charset = 'UTF-8';
  script.setAttribute('crossorigin', '*');
  document.body.appendChild(script);
}

interface OrderContext {
  orderNumber?: string | null;
  orderStatus?: string | null;
}

export function useTawkChat({ orderNumber, orderStatus }: OrderContext = {}) {
  const { customer } = useCustomer();

  // Show while this page is mounted, hide on leave.
  useEffect(() => {
    if (!EMBED_URL) return;
    loadOnce();
    whenReady((api) => api.showWidget?.());
    return () => {
      whenReady((api) => {
        api.minimize?.();
        api.hideWidget?.();
      });
    };
  }, []);

  // Who's chatting and about which order — shown to the team in the Tawk.to
  // dashboard next to the conversation.
  useEffect(() => {
    if (!EMBED_URL || !customer) return;
    const attributes: Record<string, string> = {
      name: customer.fullName || customer.mobileNumber,
      phone: customer.mobileNumber,
    };
    if (customer.email) attributes.email = customer.email;
    if (orderNumber) attributes['order-number'] = orderNumber;
    if (orderStatus) attributes['order-status'] = orderStatus;

    // Before load, Tawk_API.visitor prefills the pre-chat details.
    const api = window.Tawk_API;
    if (api && !isReady) api.visitor = { name: attributes.name, email: attributes.email };

    whenReady((readyApi) => {
      readyApi.setAttributes?.(attributes, () => {});
      if (orderNumber) readyApi.addTags?.([orderNumber], () => {});
    });
  }, [customer, orderNumber, orderStatus]);
}
