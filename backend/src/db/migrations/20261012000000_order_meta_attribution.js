// Meta Conversions API: the browser identifiers captured at checkout (_fbp /
// _fbc cookies, client IP, user agent, page URL) so the server-side Purchase
// event — sent later, when the payment webhook confirms the order — can be
// matched to the same visitor and ad click.

export const up = (pgm) => {
  pgm.sql('ALTER TABLE orders ADD COLUMN meta_attribution JSONB;');
};

export const down = (pgm) => {
  pgm.sql('ALTER TABLE orders DROP COLUMN meta_attribution;');
};
