import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, dehydrate } from '@tanstack/react-query';
import { App } from './App';
import { HeadContext, defaultHead, type HeadData } from './seo/head';
import { prefetchForRoute } from './seo/prefetch';
import { renderHeadHtml } from './seo/renderHeadHtml';

export interface RenderResult {
  html: string;
  headHtml: string;
  dehydratedStateJson: string;
  notFound: boolean;
}

// Used by web/server (plan §1a) for the four public SSR route types only —
// Cart/Wishlist/Account/Login render this same App tree but get a shell
// (see web/server/index.js), never call this function.
export async function render(url: string): Promise<RenderResult> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const { notFound } = await prefetchForRoute(queryClient, url);

  let head: HeadData = defaultHead;
  const html = renderToString(
    <StrictMode>
      <HeadContext.Provider value={{ set: (data) => (head = data) }}>
        <QueryClientProvider client={queryClient}>
          <StaticRouter location={url}>
            <App />
          </StaticRouter>
        </QueryClientProvider>
      </HeadContext.Provider>
    </StrictMode>,
  );

  const dehydratedState = dehydrate(queryClient);
  // < mitigates a </script> breakout if any fetched text (product name,
  // description, ...) ever contains it verbatim.
  const dehydratedStateJson = JSON.stringify(dehydratedState).replace(/</g, '\\u003c');

  return { html, headHtml: renderHeadHtml(head), dehydratedStateJson, notFound };
}

// Used for CSR-only routes (cart/wishlist/account/login) and as the
// render-failure fallback (plan §1a: "falls back to a minimal shell ...
// rather than a 500") — no data prefetch, no App render, client takes over.
export function renderShellHead(): { headHtml: string } {
  return { headHtml: renderHeadHtml(defaultHead) };
}
