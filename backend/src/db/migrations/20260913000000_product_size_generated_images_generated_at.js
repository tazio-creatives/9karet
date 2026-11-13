// Separate from updated_at, which also gets bumped by beginGeneration (job
// enqueued) and markStale (measurements edited) — neither of those is "the
// image was actually generated". generated_at is set only by markResult
// (the job actually finishing, pass/warning/fail), so the admin panel can
// show a trustworthy "last generated on" timestamp that survives a later
// staleness flip instead of being overwritten by it.

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE product_size_generated_images
      ADD COLUMN generated_at TIMESTAMPTZ;
  `);
  // Backfill existing rows that already reached a terminal generation
  // status — best-effort using updated_at, since no separate value was ever
  // recorded before this column existed.
  pgm.sql(`
    UPDATE product_size_generated_images
    SET generated_at = updated_at
    WHERE status IN ('passed', 'warning', 'failed');
  `);
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE product_size_generated_images DROP COLUMN IF EXISTS generated_at;`);
};
