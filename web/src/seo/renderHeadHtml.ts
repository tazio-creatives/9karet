import type { HeadData } from './head';
import { SITE_URL } from '../config';

// Server-side counterpart to head.tsx's applyHeadToDom — builds the same
// information as a raw HTML string for injection into the SSR shell's
// <head>, so it's present in the initial response bots see (plan §1a).
export function renderHeadHtml(head: HeadData): string {
  const canonicalUrl = `${SITE_URL}${head.canonicalPath}`;
  const imageUrl = head.image ?? `${SITE_URL}/images/logo.png`;

  const jsonLdScripts = head.jsonLd
    .map(
      // data-jsonld lets head.tsx's applyHeadToDom remove these on the
      // client before writing its own — otherwise every block appeared twice
      // once the page hydrated.
      (entry, i) =>
        `<script type="application/ld+json" data-jsonld="${i}">${JSON.stringify(entry).replace(/</g, '\\u003c')}</script>`,
    )
    .join('\n    ');

  return [
    `<title>${escapeHtml(head.title)}</title>`,
    `<meta name="description" content="${escapeHtml(head.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:title" content="${escapeHtml(head.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(head.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:type" content="website" />`,
    // Site name for Google's "site name" and link previews (WhatsApp, Facebook).
    `<meta property="og:site_name" content="9KARET" />`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    `<meta property="og:locale" content="en_IN" />`,
    // X (Twitter) falls back to og:* for anything not set here, but needs
    // twitter:card to show a preview at all. Large image only when the page
    // has its own photo — the logo fallback looks wrong stretched to 2:1.
    `<meta name="twitter:card" content="${head.image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escapeHtml(head.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(head.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
    jsonLdScripts,
  ].join('\n    ');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
