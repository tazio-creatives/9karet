// Structured return requests — separate from orders.order_status, which
// stays the courier/fulfilment-facing field (RETURN_INITIATED/RETURNED are
// still set exactly as before, via the existing admin Change Status
// control). This table is the customer-submitted evidence + a lightweight
// admin review trail (reason, optional unboxing video, approve/reject),
// mirroring invoice_prints/work_order_prints' pattern of a small dedicated
// table rather than overloading order_status_history.
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE return_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      note TEXT,
      video_url TEXT,
      status TEXT NOT NULL DEFAULT 'REQUESTED'
        CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      resolved_at TIMESTAMPTZ,
      resolved_by_admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL
    );
  `);
  pgm.sql('CREATE INDEX return_requests_order_id_idx ON return_requests(order_id, created_at DESC);');

  // A customer-submitted return request is its own distinct source, not
  // 'SYSTEM' — same granularity ADMIN/PAYMENT_GATEWAY/DELHIVERY already have.
  pgm.sql('ALTER TABLE order_status_history DROP CONSTRAINT order_status_history_source_check;');
  pgm.sql(`
    ALTER TABLE order_status_history ADD CONSTRAINT order_status_history_source_check
      CHECK (source IN ('ADMIN', 'PAYMENT_GATEWAY', 'DELHIVERY', 'CUSTOMER', 'SYSTEM'));
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS return_requests;');
  pgm.sql('ALTER TABLE order_status_history DROP CONSTRAINT order_status_history_source_check;');
  pgm.sql(`
    ALTER TABLE order_status_history ADD CONSTRAINT order_status_history_source_check
      CHECK (source IN ('ADMIN', 'PAYMENT_GATEWAY', 'DELHIVERY', 'SYSTEM'));
  `);
};
