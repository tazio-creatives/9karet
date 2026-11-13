// One-time repair for orders stuck in RETURN_INITIATED by the old return
// flow (fixed alongside this migration):
//   - return request REJECTED  -> order back to DELIVERED (customer kept it)
//   - return request COMPLETED -> order RETURNED (item came back)
// Only the order's most recent return request counts. Each repaired order
// gets a status-history row explaining the change.

export const up = (pgm) => {
  pgm.sql(`
    WITH latest AS (
      SELECT DISTINCT ON (order_id) order_id, status
      FROM return_requests
      ORDER BY order_id, created_at DESC
    ),
    fixes AS (
      SELECT o.id AS order_id,
             CASE l.status WHEN 'REJECTED' THEN 'DELIVERED' ELSE 'RETURNED' END AS new_status
      FROM orders o
      JOIN latest l ON l.order_id = o.id
      WHERE o.order_status = 'RETURN_INITIATED' AND l.status IN ('REJECTED', 'COMPLETED')
    ),
    updated AS (
      UPDATE orders o
      SET order_status = f.new_status,
          status = CASE f.new_status WHEN 'DELIVERED' THEN 'DELIVERED' ELSE 'REFUNDED' END,
          updated_at = now()
      FROM fixes f
      WHERE o.id = f.order_id
      RETURNING o.id, f.new_status
    )
    INSERT INTO order_status_history (order_id, status, note, source)
    SELECT id, new_status,
           CASE new_status
             WHEN 'DELIVERED' THEN 'Status corrected: return request had been rejected'
             ELSE 'Status corrected: returned item had been received'
           END,
           'SYSTEM'
    FROM updated;
  `);
};

// Data repair only — the previous (stuck) statuses aren't worth restoring.
export const down = () => {};
