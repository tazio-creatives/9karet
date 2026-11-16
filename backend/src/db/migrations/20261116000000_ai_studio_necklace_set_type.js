// AI Image Studio, Necklace: whether the product is a necklace on its own or
// a necklace + matching earrings set. The AI suggests it in the existing
// analysis call; the admin confirms or changes it on Analyse & Confirm (the
// same suggest / confirm pattern as customer_category). Nullable: jobs
// confirmed before this column existed (and every non-Necklace job) keep
// NULL and today's prompts exactly.

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE ai_studio_jobs
      ADD COLUMN necklace_set_type TEXT
        CHECK (necklace_set_type IN ('NECKLACE_ONLY', 'NECKLACE_SET'));
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE ai_studio_jobs
      DROP COLUMN necklace_set_type;
  `);
};
