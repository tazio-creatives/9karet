// Lets a customer attach photos of the actual product to their review
// (plan follow-up) — a separate table rather than an array column, matching
// this codebase's existing pattern for one-to-many attachments
// (shipment_tracking_events, order_status_history).

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE review_images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX review_images_review_id_idx ON review_images(review_id);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS review_images;');
};
