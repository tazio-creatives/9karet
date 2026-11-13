import { useEffect, useState } from 'react';

// Account/orders pages are CSR-only (not part of the SSR route list), so
// reading window.matchMedia synchronously in the initializer is safe here —
// no server render to crash.
export function useIsMobile(breakpointPx = 767) {
  const query = `(max-width: ${breakpointPx}px)`;
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handleChange = () => setIsMobile(mql.matches);
    handleChange();
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [query]);

  return isMobile;
}
