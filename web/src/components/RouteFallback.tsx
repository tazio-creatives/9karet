import placeholderStyles from '../pages/PlaceholderPage.module.css';

// Suspense fallback for lazy-loaded routes (App.tsx's `lazy(() => import(...))`
// pages). Deliberately mounted *inside* each layout's own <Outlet/> — not at
// the App root — so a route-chunk download only blanks the content area,
// never the Header/Footer/nav chrome around it (that was the "page looks
// broken while loading" bug: the old root-level Suspense boundary suspended
// the whole StorefrontLayout, including Header/Footer, on every navigation
// to a lazy page).
export function RouteFallback() {
  return <p className={placeholderStyles.body}>Loading…</p>;
}
