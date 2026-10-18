import { createContext, useContext, useEffect } from 'react';
import { SITE_URL } from '../config';
import { organizationJsonLd } from './jsonLd';

export interface HeadData {
  title: string;
  description: string;
  canonicalPath: string;
  jsonLd: object[];
  // Absolute URL for og:image / twitter:image (link previews). Falls back to
  // the logo in renderHeadHtml when a page has no image of its own.
  image?: string;
}

export const defaultHead: HeadData = {
  title: '9KARET | 9K Gold & Gemstone Jewellery Online',
  description:
    'Shop BIS hallmarked 9K gold rings, earrings, necklaces, pendants and bracelets set with genuine gemstones at 9KARET. Smart gold, transparent pricing.',
  canonicalPath: '/',
  jsonLd: [organizationJsonLd()],
};

interface HeadContextValue {
  set: (data: HeadData) => void;
}

// Only provided during SSR (entry-server.tsx) — on the client this is null
// and useHead falls through to the DOM-effect path below. A plain mutable
// callback works here (not a hook) because renderToString is a single
// synchronous pass: by the time it returns, whichever page component
// rendered has already called set() with its final head data.
export const HeadContext = createContext<HeadContextValue | null>(null);

function setMetaTag(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonicalLink(href: string) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function applyHeadToDom(data: HeadData) {
  document.title = data.title;
  setMetaTag('description', data.description);
  setCanonicalLink(`${SITE_URL}${data.canonicalPath}`);

  document.querySelectorAll('script[data-jsonld]').forEach((el) => el.remove());
  data.jsonLd.forEach((entry, i) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.jsonld = String(i);
    script.textContent = JSON.stringify(entry);
    document.head.appendChild(script);
  });
}

// Called by each of the 4 SSR page components (Home/PLP/Collection/PDP)
// with the head data for what they're currently rendering. On the server
// this feeds the <head> the render host injects into the HTML shell; on
// the client (both on hydration and subsequent SPA navigations) it applies
// the same data imperatively so <head> stays correct without a re-render.
export function useHead(data: HeadData) {
  const ctx = useContext(HeadContext);
  ctx?.set(data);

  useEffect(() => {
    applyHeadToDom(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.title, data.description, data.canonicalPath, JSON.stringify(data.jsonLd)]);
}
