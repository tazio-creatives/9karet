import type { HeadData } from './head';
import { SITE_URL } from '../config';

// Server-side counterpart to head.tsx's applyHeadToDom — builds the same
// information as a raw HTML string for injection into the SSR shell's
// <head>, so it's present in the initial response bots see (plan §1a).
export function renderHeadHtml(head: HeadData): string {
  const canonicalUrl = `${SITE_URL}${head.canonicalPath}`;

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
    `<meta property="og:site_name" content="BOX DIAMONDS" />`,
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
