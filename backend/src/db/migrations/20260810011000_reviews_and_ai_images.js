// reviews (gated on orders.status = DELIVERED at the application layer — see plan
// §11a; one review per order_item enforced here via a partial unique index) and
// ai_image_jobs/ai_generated_images (structured results — see plan §10).

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      title TEXT,
      body TEXT,
      is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX reviews_product_status_idx ON reviews(product_id, status);');
  pgm.sql('CREATE INDEX reviews_user_id_idx ON reviews(user_id);');
  pgm.sql(`
    CREATE UNIQUE INDEX reviews_one_per_order_item
      ON reviews(order_item_id)
      WHERE order_item_id IS NOT NULL;
  `);

  pgm.sql(`
    CREATE TABLE ai_image_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')),
      provider TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX ai_image_jobs_product_id_idx ON ai_image_jobs(product_id);');
  pgm.sql('CREATE INDEX ai_image_jobs_status_idx ON ai_image_jobs(status);');

  pgm.sql(`
    CREATE TABLE ai_generated_images (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID NOT NULL REFERENCES ai_image_jobs(id) ON DELETE CASCADE,
      image_url TEXT,
      image_buffer BYTEA,
      provider_job_id TEXT,
      metadata JSONB,
      approved BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX ai_generated_images_job_id_idx ON ai_generated_images(job_id);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS ai_generated_images;');
  pgm.sql('DROP TABLE IF EXISTS ai_image_jobs;');
  pgm.sql('DROP TABLE IF EXISTS reviews;');
};
