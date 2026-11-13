// Recovers a storageProvider key from a previously-saved public URL — used
// wherever code needs to re-read/delete an object it only has the URL for
// (e.g. re-reading an AI Studio reference image, deleting a superseded
// enhancement candidate). Provider-agnostic on purpose: the local provider's
// URLs carry an extra "/uploads" path segment (its public base URL is
// "http://host/uploads"), while the S3 provider's URLs don't (the bucket
// itself is the root) — stripping both a leading slash and an optional
// leading "uploads/" handles either shape without needing to know which
// provider is actually active.
export function keyFromUrl(url) {
  return new URL(url).pathname.replace(/^\//, '').replace(/^uploads\//, '');
}
