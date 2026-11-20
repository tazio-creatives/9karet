// AI Image Studio, Bangle: the admin-confirmed bangle set — one bangle, an
// identical pair, or a pair of two different designs. The AI suggests it in
// the existing analysis call (wristPieceCount + bangleSetType); the admin
// confirms or changes it on Analyse & Confirm (same suggest / confirm pattern
// as necklace_set_type). When set it replaces the AI's own count for every
// prompt, validation and regeneration of the job. Nullable: jobs confirmed
// before this column existed (and every non-Bangle job) keep NULL and fall
// back to the AI's analysis exactly as before.

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE ai_studio_jobs
      ADD COLUMN bangle_set_type TEXT
        CHECK (bangle_set_type IN ('SINGLE', 'IDENTICAL_PAIR', 'DISTINCT_PAIR'));
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE ai_studio_jobs
      DROP COLUMN bangle_set_type;
  `);
};
