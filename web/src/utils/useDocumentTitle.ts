import { useEffect } from 'react';

// For CSR-only pages that aren't part of the SSR/SEO surface (plan §1a
// scopes SSR + JSON-LD to Home/PLP/Collection/PDP only) — Cart/Wishlist
// just need a sensible tab title, not the full seo/head.tsx machinery.
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} | 9KARET` : '9KARET';
  }, [title]);
}
