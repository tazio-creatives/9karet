import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCachedPage, savePage } from './pageCache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..'); // web/
const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.WEB_PORT ?? 5173);

// Everything else in App.tsx (cart/wishlist/account/login/checkout/order-
// confirmation, the catch-all) is CSR-only per plan §1a — these get a plain
// shell, never SSR/cached. Kept in sync by hand with App.tsx's route list
// (Phases 9-12 added several of these after this classifier was first
// written, which is exactly the kind of drift that silently 404's a page —
// see the /account/addresses bug this list fixes).
const CSR_ONLY_SINGLE_SEGMENT = new Set([
  'cart',
  'wishlist',
  'login',
  'checkout',
  'search',
  'account',
  'shipping-policy',
  'refund-policy',
  'return-policy',
  'cancellation-policy',
  'privacy-policy',
  'terms',
  'contact',
  'faqs',
  'size-guide',
  'care-guide',
  'careers',
  'press',
]);
const CSR_ONLY_PREFIXES = ['account', 'order-confirmation'];

function classifyRoute(pathname) {
  if (pathname === '/') return 'home';
  const segments = pathname.split('/').filter(Boolean);

  if (CSR_ONLY_PREFIXES.includes(segments[0])) return null;
  // /blog and /blog/:slug — must be checked before the generic 1/2-segment
  // PLP/PDP rules below, or a post URL would be treated as a product.
  if (segments[0] === 'blog' && segments.length <= 2) return 'blog';
  if (segments.length === 1) return CSR_ONLY_SINGLE_SEGMENT.has(segments[0]) ? null : 'plp';
  if (segments.length === 2) return segments[0] === 'collections' ? 'collection' : 'pdp';
  return null;
}

async function createServer() {
  const app = express();

  // Standard browser protections (the API already sends these via helmet).
  // No Content-Security-Policy here: GTM, Tawk.to and Cashfree load scripts
  // and frames from their own domains and would need a hand-tuned allowlist.
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // no framing by other sites (clickjacking)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // Brotli/gzip at this process since there's no reverse proxy in front of
  // it yet (plan §13) — cut ~270KB off the JS/CSS/HTML payload per Lighthouse.
  app.use(compression());

  // dist/client/index.html is the raw SSR template (no title/description,
  // empty #root) — the static middleware below would otherwise serve it
  // as-is at /index.html, a crawlable titleless duplicate of the homepage.
  app.get('/index.html', (req, res) => res.redirect(301, '/'));

  // Renamed category URLs — old links move permanently to the new slug,
  // query string kept. Add an entry here whenever a live category slug is
  // renamed; don't reuse an old slug for a new category while it's listed.
  const RENAMED_CATEGORY_SLUGS = {};
  app.use((req, res, next) => {
    const match = /^\/([^/]+)(\/.*)?$/.exec(req.path);
    const renamed = match && RENAMED_CATEGORY_SLUGS[match[1]];
    if (!renamed) return next();
    const query = req.originalUrl.slice(req.path.length);
    return res.redirect(301, `/${renamed}${match[2] ?? ''}${query}`);
  });

  let vite;
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({ root, server: { middlewareMode: true }, appType: 'custom' });
    app.use(vite.middlewares);
  } else {
    app.use(
      '/assets',
      express.static(path.join(root, 'dist/client/assets'), { immutable: true, maxAge: '1y' }),
    );
    // public/ files (logo, favicons, page photos) aren't content-hashed, so
    // not `immutable` — but they change rarely, and without a max-age
    // Cloudflare fell back to a 4h browser cache (flagged by PageSpeed).
    // Changing one of these files means renaming it, or waiting out 30 days.
    app.use(express.static(path.join(root, 'dist/client'), { index: false, maxAge: '30d' }));
  }

  async function loadSsrModule(specifier) {
    if (!isProd) return vite.ssrLoadModule(specifier);
    // Each SSR entry is built independently via its own `vite build --ssr
    // <entry> --outDir dist/server` invocation (see package.json), and Vite
    // flattens a single-entry SSR build's output to <outDir>/<basename>.js —
    // it does not preserve the source directory structure. Mapping by
    // basename (not by stripping '/src/') is what actually matches that
    // output; a previous version of this function derived 'seo/sitemap.js'
    // for '/src/seo/sitemap.ts', which never existed on disk and crashed
    // both /sitemap.xml and /robots.txt in production.
    const builtPath = `${path.basename(specifier).replace(/\.tsx?$/, '')}.js`;
    return import(path.join(root, 'dist/server', builtPath));
  }

  async function getTemplate(url) {
    const templatePath = path.join(root, isProd ? 'dist/client/index.html' : 'index.html');
    let template = await fs.readFile(templatePath, 'utf-8');
    if (!isProd) template = await vite.transformIndexHtml(url, template);
    return template;
  }

  function injectTemplate(template, { headHtml, appHtml, stateJson }) {
    return template
      .replace('<!--ssr-head-->', headHtml)
      .replace('<!--ssr-outlet-->', appHtml)
      .replace('/*ssr-state*/undefined', stateJson);
  }

  async function renderShellHtml(url) {
    const { renderShellHead } = await loadSsrModule('/src/entry-server.tsx');
    const { headHtml } = renderShellHead();
    const template = await getTemplate(url);
    return injectTemplate(template, { headHtml, appHtml: '', stateJson: 'undefined' });
  }

  app.get('/sitemap.xml', async (req, res) => {
    try {
      const { buildSitemapXml } = await loadSsrModule('/src/seo/sitemap.ts');
      const xml = await buildSitemapXml();
      res.status(200).set('Content-Type', 'application/xml').send(xml);
    } catch (err) {
      console.error('sitemap generation failed:', err);
      res.status(500).end();
    }
  });

  app.get('/robots.txt', async (req, res) => {
    // Express 4 does not catch rejected promises thrown by an async route
    // handler — an uncaught rejection here previously took down the entire
    // process (Node's default is to terminate on unhandled rejection),
    // meaning a single crawler request could 500 every concurrent shopper.
    // Every async handler in this file must catch its own errors; there is
    // no framework-level safety net.
    try {
      const { buildRobotsTxt } = await loadSsrModule('/src/seo/sitemap.ts');
      res.status(200).set('Content-Type', 'text/plain').send(buildRobotsTxt());
    } catch (err) {
      console.error('robots.txt generation failed:', err);
      res.status(500).end();
    }
  });

  app.use('*', async (req, res) => {
    const url = req.originalUrl;

    try {
      const pathname = new URL(url, 'http://internal').pathname;
      const routeType = classifyRoute(pathname);

      if (!routeType) {
        const html = await renderShellHtml(url);
        res.status(200).set('Content-Type', 'text/html').end(html);
        return;
      }

      // page_cache is a request-time cache for production (plan §1a) — in
      // dev every request should re-render from the current source on disk.
      // Reading/writing it here while iterating on components was silently
      // serving old markup/CSS-module hashes for up to SSR_CACHE_TTL_SECONDS
      // after an edit, surviving even a full `npm run dev` restart since the
      // cache lives in Postgres, not the Node process — easy to mistake for
      // a Vite HMR/module-graph bug.
      const cached = isProd ? await getCachedPage(url) : null;
      if (cached) {
        res.status(200).set('Content-Type', 'text/html').end(cached);
        return;
      }

      const { render } = await loadSsrModule('/src/entry-server.tsx');
      const { html: appHtml, headHtml, dehydratedStateJson, notFound } = await render(url);
      const template = await getTemplate(url);
      const html = injectTemplate(template, { headHtml, appHtml, stateJson: dehydratedStateJson });

      if (!notFound && isProd) {
        savePage(url, html).catch((err) => console.error('page_cache write failed:', err));
      }

      res.status(notFound ? 404 : 200).set('Content-Type', 'text/html').end(html);
    } catch (err) {
      if (!isProd && vite) vite.ssrFixStacktrace(err);
      // plan §1a: a render failure falls back to a minimal shell (200, no
      // SSR content), never a 500 — the client then fetches normally.
      console.error('SSR render failed, falling back to shell:', err);
      try {
        const html = await renderShellHtml(url);
        res.status(200).set('Content-Type', 'text/html').end(html);
      } catch (shellErr) {
        console.error('Shell fallback also failed:', shellErr);
        res.status(500).end('Internal Server Error');
      }
    }
  });

  app.listen(port, () => {
    console.log(`web SSR server listening on http://localhost:${port} [${isProd ? 'production' : 'development'}]`);
  });
}

createServer();
