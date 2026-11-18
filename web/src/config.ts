// Placeholder site origin (plan §1a) — used for canonical URLs and JSON-LD.
// One-line swap once a real domain is chosen, same pattern as the
// VITE_API_BASE_URL placeholder in api/client.ts.
export const SITE_URL = import.meta.env.VITE_SITE_URL ?? 'http://localhost:5173';

// Official social profiles — the footer icons and the Organization JSON-LD
// sameAs (which tells Google these profiles belong to this site) both read
// this one list. Empty until 9Karet's own profiles exist: a profile is only
// shown/linked once its URL is filled in here.
export const SOCIAL_LINKS: { instagram?: string; facebook?: string } = {};

// Header "Explore Diamonds Collection" button. Set VITE_BOX_DIAMONDS_URL (or
// fill it in here); until then the button shows but is not clickable.
export const BOX_DIAMONDS_URL: string | undefined = import.meta.env.VITE_BOX_DIAMONDS_URL || undefined;

// Header "Stores" button. No store-locator page exists yet, so it opens the
// Contact page (which has the store address) until one does.
export const STORES_URL = '/contact';
