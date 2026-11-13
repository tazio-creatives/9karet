import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router (declarative mode, no data router here) never resets scroll
// position on navigation — without this, clicking a product/category link
// leaves the new page scrolled to wherever the previous page's viewport was.
// A no-op during SSR (renderToString never runs effects).
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
