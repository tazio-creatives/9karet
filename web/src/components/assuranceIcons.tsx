// Shared icon set for the homepage assurance strip (pages/home/AssuranceStrip
// .tsx) and the Product Detail Page assurance grid (ProductAssuranceGrid.tsx)
// — same outline-icon shapes in both places, per the PDP assurance spec's
// "may share: assurance content constants, icon mapping" note. Each caller
// keeps its own layout/CSS and its own title/description text — only the
// glyphs are shared. `currentColor` stroke, no fill, so each caller controls
// icon colour entirely from its own CSS.
export function GemIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4.5 8l3-5h9l3 5-8.5 12.5z" strokeLinejoin="round" />
      <path d="M4.5 8h15M9.5 3l-1.8 5 4.3 12.5 4.3-12.5-1.8-5" strokeLinejoin="round" />
    </svg>
  );
}

export function HallmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 3l9 16.5H3z" strokeLinejoin="round" />
      <circle cx="12" cy="14.3" r="2.3" />
    </svg>
  );
}

export function BuybackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M20.5 3.5v5h-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 8.5A8 8 0 1 1 17.6 2" strokeLinecap="round" />
      <path d="M7.5 8h5.2M7.5 8c3 0 5 1.4 5 3.4s-2.1 3.4-5 3.4H7.5l5.8 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ExchangeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M17 3.5l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 7.5H8a5 5 0 0 0-5 5" strokeLinecap="round" />
      <path d="M7 20.5l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 16.5h13a5 5 0 0 0 5-5" strokeLinecap="round" />
    </svg>
  );
}

export function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 3l7.5 3v5.2c0 5-3.2 8.7-7.5 10.3-4.3-1.6-7.5-5.3-7.5-10.3V6z" strokeLinejoin="round" />
      <path d="M8.7 12.2l2.3 2.3 4.3-4.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
