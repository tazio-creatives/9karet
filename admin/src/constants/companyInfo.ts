// Single source of truth for the invoice's legal seller block — mirrors
// web/src/pages/policies/PolicyContact.tsx's address/CIN (kept in sync
// manually since the two apps don't share a package). GSTIN is not yet on
// file anywhere in the codebase — replace GSTIN_PLACEHOLDER once the real
// number is available; every invoice printed before then will visibly show
// the placeholder rather than a silently wrong number.
export const COMPANY_INFO = {
  displayName: '9Karet',
  legalName: 'Goldbox Diamonds Private Limited',
  cin: 'U32111MH2025PTC458218',
  gstin: 'GSTIN_PLACEHOLDER',
  addressLines: ['No 281/287, 39 1-3, Narsi Natha Street', 'Princess Dock, Mumbai – 400009, Maharashtra'],
  email: 'info@9karet.com',
  website: 'www.9karet.com',
};
