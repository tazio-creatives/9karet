// Phase 2 (job-card / work-order printing). A dedicated audit table rather than
// reusing order_status_history — work-order print events are an admin-internal
// operational log (who printed the picking/packing slip and when), not a
// customer-visible order-lifecycle event, and order_status_history rows are
// shown to customers via findOrderStatusHistory(). Keeping them separate means
// no risk of a "Work Order Printed" line ever leaking onto the customer's
// order timeline.
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE work_order_prints (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      printed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX work_order_prints_order_id_idx ON work_order_prints(order_id, printed_at);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS work_order_prints;');
};
