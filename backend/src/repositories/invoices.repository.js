import { query, withTransaction } from '../config/db.js';

// Indian financial year: April 1 -> March 31. A date in Jan-Mar belongs to
// the FY that STARTED the previous calendar year (e.g. Feb 2027 is FY
// 26-27, same as Nov 2026 is).
export function financialYearLabel(date = new Date()) {
  const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  const startYY = String(year).slice(-2);
  const endYY = String(year + 1).slice(-2);
  return `${startYY}-${endYY}`;
}

// Atomic get-and-increment: a brand new financial year's row starts life
// at 1 (the plain INSERT value applies since there's no conflict yet); an
// existing row's next_seq is incremented first and the POST-increment
// value is what gets returned/assigned — so the row always holds "the
// last number handed out", not "the next one due", avoiding any separate
// off-by-one bookkeeping between the insert and update branches.
async function nextInvoiceSeqTx(client, financialYear) {
  const { rows } = await client.query(
    `INSERT INTO invoice_number_counters (financial_year, next_seq)
     VALUES ($1, 1)
     ON CONFLICT (financial_year) DO UPDATE SET next_seq = invoice_number_counters.next_seq + 1
     RETURNING next_seq`,
    [financialYear],
  );
  return rows[0].next_seq;
}

// Assigns an invoice number exactly once per order (idempotent — a
// re-download must never mint a second number). Locks the order row first
// so two concurrent "first view" requests for the same order can't both
// pass the "not yet assigned" check and burn two sequence numbers on one
// order.
export async function assignInvoiceNumberIfNeeded(orderId) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT invoice_number, invoice_generated_at FROM orders WHERE id = $1 FOR UPDATE',
      [orderId],
    );
    const existing = rows[0]?.invoice_number;
    if (existing) return { invoiceNumber: existing, invoiceGeneratedAt: rows[0].invoice_generated_at };

    const fy = financialYearLabel();
    const seq = await nextInvoiceSeqTx(client, fy);
    const invoiceNumber = `BD/${fy}/${String(seq).padStart(4, '0')}`;

    const { rows: updated } = await client.query(
      'UPDATE orders SET invoice_number = $2, invoice_generated_at = now() WHERE id = $1 RETURNING invoice_generated_at',
      [orderId, invoiceNumber],
    );
    return { invoiceNumber, invoiceGeneratedAt: updated[0].invoice_generated_at };
  });
}

export async function findInvoicePrints(orderId) {
  const { rows } = await query(
    `SELECT p.*, a.full_name AS admin_name
     FROM invoice_prints p
     LEFT JOIN admin_users a ON a.id = p.admin_user_id
     WHERE p.order_id = $1
     ORDER BY p.printed_at`,
    [orderId],
  );
  return rows;
}

export async function insertInvoicePrint(orderId, adminId) {
  const { rows } = await query(
    'INSERT INTO invoice_prints (order_id, admin_user_id) VALUES ($1, $2) RETURNING *',
    [orderId, adminId],
  );
  return rows[0];
}
