import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { pixelPageView } from '../analytics/metaPixel';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { RouteFallback } from '../components/RouteFallback';

// Meta Pixel PageView on the first load and on every in-app navigation
// (page path or query changes, e.g. a filter), since this app doesn't reload.
function usePixelPageViews() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    pixelPageView();
  }, [pathname, search]);
}

export function StorefrontLayout() {
  usePixelPageViews();
  return (
    <div>
      <Header />
      <main>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
