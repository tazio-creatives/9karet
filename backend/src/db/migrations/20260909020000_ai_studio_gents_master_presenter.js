// Gents presenter identity consistency: stores the one-off "master" adult
// male identity portrait generated for a Gents job (see
// generateGentsMasterPresenter in aiStudioService.js) so every Gents
// PRESENTER_* generation/regeneration in the job reuses the exact same
// reference image instead of each shot inventing a different man. Nullable —
// unset until the first Gents presenter shot in a job actually generates one,
// and reset back to null only when the admin explicitly clicks
// "Change Gents Presenter". Scoped to GENTS only; every other customer
// category never touches this column.

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE ai_studio_jobs ADD COLUMN gents_master_presenter_key TEXT;`);
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE ai_studio_jobs DROP COLUMN gents_master_presenter_key;`);
};
