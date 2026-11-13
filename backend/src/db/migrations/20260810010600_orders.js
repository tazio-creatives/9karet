// orders, order_items (price snapshot at placement), order_status_history,
// payments (idempotent via UNIQUE provider+provider_ref), shipments.
// See plan §3/§9a/§11/§11b (corrected: PENDING_PAYMENT + webhook-only confirmation).
//
// Note: orders does NOT have a coupon_id column — coupon_usage(coupon_id, user_id,
// order_id) already captures which coupon applied to which order, so a redundant
// column on orders was left out.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_number TEXT NOT NULL UNIQUE, -- human-facing display id, generated in Phase 10
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (status IN (
        'PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED',
        'PAYMENT_FAILED', 'EXPIRED', 'CANCELLED', 'RETURN_REQUESTED', 'REFUNDED'
      )),

      contact_name TEXT NOT NULL,
      contact_mobile TEXT NOT NULL,
      contact_email TEXT NOT NULL,

      shipping_address JSONB NOT NULL, -- snapshot of the chosen address at order time

      subtotal NUMERIC(12, 2) NOT NULL,
      discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      gst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      shipping_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      total_amount NUMERIC(12, 2) NOT NULL,

      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX orders_user_id_status_idx ON orders(user_id, status);');
  pgm.sql('CREATE INDEX orders_status_idx ON orders(status);');

  pgm.sql(`
    CREATE TABLE order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

      product_name TEXT NOT NULL, -- snapshot in case the product is later renamed
      product_sku TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),

      -- price snapshot at order placement (plan §9a "Order-time price snapshot") —
      -- never recalculated after the fact, even if the product's live price changes.
      gold_value NUMERIC(12, 2) NOT NULL,
      diamond_value NUMERIC(12, 2) NOT NULL,
      making_charge NUMERIC(12, 2) NOT NULL,
      gst_amount NUMERIC(12, 2) NOT NULL,
      unit_price NUMERIC(12, 2) NOT NULL,
      line_total NUMERIC(12, 2) NOT NULL,
      gold_rate_id UUID REFERENCES gold_rates(id) ON DELETE SET NULL,

      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX order_items_order_id_idx ON order_items(order_id);');
  pgm.sql('CREATE INDEX order_items_product_id_idx ON order_items(product_id);');

  pgm.sql(`
    CREATE TABLE order_status_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(
    'CREATE INDEX order_status_history_order_id_idx ON order_status_history(order_id, created_at);',
  );

  pgm.sql(`
    CREATE TABLE payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_ref TEXT NOT NULL, -- gateway's own transaction id
      status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED')),
      amount NUMERIC(12, 2) NOT NULL,
      raw_payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (provider, provider_ref) -- webhook idempotency: repeat delivery is a safe no-op
    );
  `);
  pgm.sql('CREATE INDEX payments_order_id_idx ON payments(order_id);');

  pgm.sql(`
    CREATE TABLE shipments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_shipment_id TEXT,
      tracking_number TEXT,
      courier_name TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      raw_webhook_payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX shipments_order_id_idx ON shipments(order_id);');
  pgm.sql(`
    CREATE UNIQUE INDEX shipments_provider_shipment_id_idx
      ON shipments(provider, provider_shipment_id)
      WHERE provider_shipment_id IS NOT NULL;
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS shipments;');
  pgm.sql('DROP TABLE IF EXISTS payments;');
  pgm.sql('DROP TABLE IF EXISTS order_status_history;');
  pgm.sql('DROP TABLE IF EXISTS order_items;');
  pgm.sql('DROP TABLE IF EXISTS orders;');
};
