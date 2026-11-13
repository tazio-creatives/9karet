// Return & Refund Policy enforcement:
//  - return_requests.photo_urls: the live photographs the policy requires
//    (jewellery, certificate, packaging/tag, the issue) alongside the video.
//  - products / categories .is_non_returnable: excluded from change-of-mind
//    returns (solitaires, custom, engraved…). A category flag covers every
//    product in it and in its subcategories.

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE return_requests ADD COLUMN photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  pgm.sql('ALTER TABLE products ADD COLUMN is_non_returnable BOOLEAN NOT NULL DEFAULT false;');
  pgm.sql('ALTER TABLE categories ADD COLUMN is_non_returnable BOOLEAN NOT NULL DEFAULT false;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE categories DROP COLUMN IF EXISTS is_non_returnable;');
  pgm.sql('ALTER TABLE products DROP COLUMN IF EXISTS is_non_returnable;');
  pgm.sql('ALTER TABLE return_requests DROP COLUMN IF EXISTS photo_urls;');
};
