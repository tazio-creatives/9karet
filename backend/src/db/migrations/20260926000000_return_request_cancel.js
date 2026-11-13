// Lets a customer cancel their own return request while it's still
// REQUESTED (before an admin has approved/rejected it) — distinct from
// REJECTED, which is an admin decision, not a customer change of mind.
export const up = (pgm) => {
  pgm.sql('ALTER TABLE return_requests DROP CONSTRAINT return_requests_status_check;');
  pgm.sql(`
    ALTER TABLE return_requests ADD CONSTRAINT return_requests_status_check
      CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'));
  `);
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE return_requests DROP CONSTRAINT return_requests_status_check;');
  pgm.sql(`
    ALTER TABLE return_requests ADD CONSTRAINT return_requests_status_check
      CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED'));
  `);
};
