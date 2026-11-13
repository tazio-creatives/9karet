// carts/cart_items and wishlist/wishlist_items, both supporting guest
// (session-keyed) and logged-in (user-keyed) ownership. See plan §3/§11/§27.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE carts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      guest_session_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (user_id IS NOT NULL OR guest_session_id IS NOT NULL)
    );
  `);
  pgm.sql(
    'CREATE UNIQUE INDEX carts_user_id_unique_idx ON carts(user_id) WHERE user_id IS NOT NULL;',
  );
  pgm.sql(
    'CREATE UNIQUE INDEX carts_guest_session_unique_idx ON carts(guest_session_id) WHERE guest_session_id IS NOT NULL;',
  );

  pgm.sql(`
    CREATE TABLE cart_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (cart_id, product_id)
    );
  `);
  pgm.sql('CREATE INDEX cart_items_cart_id_idx ON cart_items(cart_id);');

  pgm.sql(`
    CREATE TABLE wishlist (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      guest_session_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (user_id IS NOT NULL OR guest_session_id IS NOT NULL)
    );
  `);
  pgm.sql(
    'CREATE UNIQUE INDEX wishlist_user_id_unique_idx ON wishlist(user_id) WHERE user_id IS NOT NULL;',
  );
  pgm.sql(
    'CREATE UNIQUE INDEX wishlist_guest_session_unique_idx ON wishlist(guest_session_id) WHERE guest_session_id IS NOT NULL;',
  );

  pgm.sql(`
    CREATE TABLE wishlist_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wishlist_id UUID NOT NULL REFERENCES wishlist(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (wishlist_id, product_id)
    );
  `);
  pgm.sql('CREATE INDEX wishlist_items_wishlist_id_idx ON wishlist_items(wishlist_id);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS wishlist_items;');
  pgm.sql('DROP TABLE IF EXISTS wishlist;');
  pgm.sql('DROP TABLE IF EXISTS cart_items;');
  pgm.sql('DROP TABLE IF EXISTS carts;');
};
