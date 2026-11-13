// AI Image Studio: audience-specific presenter rules (Gents/Kids). Adds a
// "customer category" dimension alongside the existing jewellery-type
// confirmation — WOMEN/GENTS/KIDS/UNISEX — captured through the exact same
// AI-suggests / admin-corrects / admin-confirms pattern already used for
// jewellery_type/ai_detected_category/category_confirmed_at. Defaults to
// 'WOMEN' (today's only presenter styling) so every existing job/prompt is
// byte-identical until an admin explicitly picks Gents or Kids.

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE ai_studio_jobs
      ADD COLUMN customer_category TEXT NOT NULL DEFAULT 'WOMEN'
        CHECK (customer_category IN ('WOMEN', 'GENTS', 'KIDS', 'UNISEX')),
      ADD COLUMN ai_detected_customer_category TEXT
        CHECK (ai_detected_customer_category IN ('WOMEN', 'GENTS', 'KIDS', 'UNISEX')),
      ADD COLUMN customer_category_confirmed_at TIMESTAMPTZ;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE ai_studio_jobs
      DROP COLUMN customer_category,
      DROP COLUMN ai_detected_customer_category,
      DROP COLUMN customer_category_confirmed_at;
  `);
};
