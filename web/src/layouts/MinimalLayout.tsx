import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { RouteFallback } from '../components/RouteFallback';

// No AnnouncementStrip/Header/Footer — for pages that own their entire
// chrome themselves (currently just Order Confirmation, which needs a
// compact header of its own and explicitly no footer). Distinct from
// StorefrontLayout rather than a prop on it, since "no footer, custom
// header" isn't a per-page toggle any other route needs.
export function MinimalLayout() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  );
}
