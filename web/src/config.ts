// Placeholder site origin (plan §1a) — used for canonical URLs and JSON-LD.
// One-line swap once a real domain is chosen, same pattern as the
// VITE_API_BASE_URL placeholder in api/client.ts.
export const SITE_URL = import.meta.env.VITE_SITE_URL ?? 'http://localhost:5173';

// Official social profiles — the footer icons and the Organization JSON-LD
// sameAs (which tells Google these profiles belong to this site) both read
// this one list.
export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/boxdiamonds01/',
  facebook: 'https://www.facebook.com/profile.php?id=61594060908005',
};
