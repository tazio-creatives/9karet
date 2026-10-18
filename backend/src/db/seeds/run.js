// Dev seed: foundational reference data (admin roles/user, categories, a
// collection, a starting gold rate, homepage sections) plus a few sample 9K
// products — not orders/carts/reviews, which need real application flows.
//
// Reference data goes in with its own pg Client in one transaction. Sample
// products are then created through productsService.adminCreateProduct —
// the same path the admin form uses — so they get their variant rows,
// stones and computed prices exactly as a real product would. Stone types
// (Ruby, Emerald, ...) are seeded by the 9karet_gold_and_stones migration.
// Idempotent: safe to re-run.

import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcrypt';
import { pool } from '../../config/db.js';
import { adminCreateProduct } from '../../services/productsService.js';
import { deriveRatesFromBase24k } from '../../services/pricingService.js';

const { Client } = pg;

// Starting 24K market rate (₹/g) — the live feed replaces it on first sync.
const SEED_RATE_24K = 7420.0;

async function seedReferenceData(client) {
  const {
    rows: [role],
  } = await client.query(
    `INSERT INTO admin_roles (name, permissions)
     VALUES ('SUPER_ADMIN', '["*"]')
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
  );

  // Starter roles for the module-permission system (backend/src/constants/
  // adminPermissions.js) — a convenience default, not the only roles that
  // can exist: SUPER_ADMIN can create/edit further roles from the Admin
  // Users page. Re-running the seed updates permissions on these two if
  // the module list changes, same ON CONFLICT pattern as SUPER_ADMIN.
  await client.query(
    `INSERT INTO admin_roles (name, permissions)
     VALUES
       ('ORDER_MANAGER', '["dashboard", "orders"]'),
       ('CATALOG_MANAGER', '["dashboard", "products", "categories", "collections", "attributes"]')
     ON CONFLICT (name) DO UPDATE SET permissions = EXCLUDED.permissions`,
  );

  const passwordHash = await bcrypt.hash('dev-only-password', 12);
  await client.query(
    `INSERT INTO admin_users (email, password_hash, full_name, role_id)
     VALUES ('admin@9karet.dev', $1, 'Dev Admin', $2)
     ON CONFLICT (email) DO NOTHING`,
    [passwordHash, role.id],
  );

  for (const [i, [name, slug]] of [
    ['Rings', 'rings'],
    ['Earrings', 'earrings'],
    ['Pendants', 'pendants'],
    ['Necklaces', 'necklaces'],
    ['Bracelets', 'bracelets'],
  ].entries()) {
    await client.query(
      `INSERT INTO categories (name, slug, sort_order) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING`,
      [name, slug, i + 1],
    );
  }

  await client.query(
    `INSERT INTO collections (name, slug, description)
     VALUES ('Everyday Gold', 'everyday-gold', 'Light 9K pieces made for wearing every day')
     ON CONFLICT (slug) DO NOTHING`,
  );

  const {
    rows: [{ count: rateCount }],
  } = await client.query(`SELECT COUNT(*)::int AS count FROM gold_rates`);
  if (rateCount === 0) {
    for (const { purity, ratePerGram } of deriveRatesFromBase24k(SEED_RATE_24K)) {
      await client.query(`INSERT INTO gold_rates (purity, rate_per_gram, source) VALUES ($1, $2, 'seed')`, [
        purity,
        ratePerGram,
      ]);
    }
  }
}

async function idBySlug(table, slug) {
  const { rows } = await pool.query(`SELECT id FROM ${table} WHERE slug = $1`, [slug]);
  if (!rows[0]) throw new Error(`Seed: missing ${table} row "${slug}"`);
  return rows[0].id;
}

// Every product carries the 9K purity axis, so a product without sizes gets
// one variant per gold colour — stock for those is set per combination,
// same as the admin form's variant matrix does.
function stockPerColour(goldColors, stockQuantity) {
  return goldColors.map((goldColor) => ({ attributeValues: { goldColor, purity: '9K' }, stockQuantity }));
}

async function seedSampleProducts() {
  const stone = (slug) => idBySlug('stone_types', slug);
  const everyday = await idBySlug('collections', 'everyday-gold');

  const samples = [
    {
      name: 'Ruby Halo Ring',
      sku: '9K-RING-0001',
      categoryId: await idBySlug('categories', 'rings'),
      collectionId: everyday,
      shortDescription: 'A 9K gold ring with a ruby centre and a halo of cubic zirconia.',
      goldWeightGrams: 2.4,
      makingChargePercent: 18,
      goldColors: ['YELLOW', 'ROSE'],
      sizes: [
        { label: '10', stockQuantity: 4 },
        { label: '12', stockQuantity: 4 },
        { label: '14', stockQuantity: 2 },
      ],
      stones: [
        { stoneTypeId: await stone('ruby'), count: 1, weightCarats: 0.3, price: 2400 },
        { stoneTypeId: await stone('cubic-zirconia'), count: 12, weightCarats: 0.24, price: 360 },
      ],
    },
    {
      name: 'Emerald Drop Earrings',
      sku: '9K-EARR-0001',
      categoryId: await idBySlug('categories', 'earrings'),
      shortDescription: 'Pear-cut emerald drops on 9K gold hooks.',
      goldWeightGrams: 1.8,
      makingChargePercent: 20,
      goldColors: ['YELLOW'],
      variantOverrides: stockPerColour(['YELLOW'], 6),
      stones: [{ stoneTypeId: await stone('emerald'), count: 2, weightCarats: 0.5, price: 3800 }],
    },
    {
      name: 'Sapphire Bar Pendant',
      sku: '9K-PEND-0001',
      categoryId: await idBySlug('categories', 'pendants'),
      collectionId: everyday,
      shortDescription: 'A slim 9K gold bar pendant set with three blue sapphires.',
      goldWeightGrams: 1.2,
      makingChargePercent: 18,
      goldColors: ['YELLOW', 'WHITE'],
      variantOverrides: stockPerColour(['YELLOW', 'WHITE'], 8),
      stones: [{ stoneTypeId: await stone('sapphire'), count: 3, weightCarats: 0.18, price: 1500 }],
    },
    {
      name: 'Classic 9K Chain Bracelet',
      sku: '9K-BRAC-0001',
      categoryId: await idBySlug('categories', 'bracelets'),
      shortDescription: 'A plain 9K gold link bracelet — no stones, just gold.',
      goldWeightGrams: 3.5,
      makingChargePercent: 12,
      goldColors: ['YELLOW'],
      variantOverrides: stockPerColour(['YELLOW'], 10),
      stones: [],
    },
  ];

  for (const sample of samples) {
    const { rows } = await pool.query('SELECT 1 FROM products WHERE sku = $1', [sample.sku]);
    if (rows.length) continue;
    await adminCreateProduct({ ...sample, gstPercent: 3, status: 'PUBLISHED' });
    console.log(`Seeded product ${sample.sku}`);
  }
}

// Homepage sections/items — only seeded on a genuinely fresh database:
// running `npm run seed` again on a DB an admin has already customised
// (uploaded hero images, curated sections) must never wipe it back to these
// placeholders.
async function seedHomepage(client) {
  const SECTION_TYPES = [
    'HERO',
    'BENTO_CATEGORIES',
    'NEW_ARRIVALS',
    'COLLECTION_CARDS',
    'FEATURED_PRODUCT',
    'BEST_SELLERS',
    'SHOP_BY_PRICE',
    'OCCASION_CARDS',
    'INSTAGRAM',
    'NEWSLETTER',
    'TRUST_STRIP',
  ];
  const {
    rows: [{ count }],
  } = await client.query(`SELECT COUNT(*)::int AS count FROM homepage_sections WHERE type = ANY($1)`, [SECTION_TYPES]);
  if (count > 0) {
    console.log(`Homepage sections already exist (${count} found) — skipping homepage seed.`);
    return;
  }

  const ids = {};
  for (const slug of ['rings', 'earrings', 'pendants']) {
    ids[slug] = (await client.query('SELECT id FROM categories WHERE slug = $1', [slug])).rows[0]?.id ?? null;
  }
  const everydayId = (await client.query(`SELECT id FROM collections WHERE slug = 'everyday-gold'`)).rows[0]?.id ?? null;

  async function createSection(type, heading, sortOrder, items) {
    const {
      rows: [section],
    } = await client.query(
      `INSERT INTO homepage_sections (type, heading, sort_order) VALUES ($1, $2, $3) RETURNING id`,
      [type, heading, sortOrder],
    );
    for (const [i, item] of items.entries()) {
      await client.query(
        `INSERT INTO homepage_items
           (section_id, image_url, heading, cta_label, cta_url, category_id, collection_id, product_id, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          section.id,
          item.imageUrl ?? null,
          item.heading ?? null,
          item.ctaLabel ?? null,
          item.ctaUrl ?? null,
          item.categoryId ?? null,
          item.collectionId ?? null,
          item.productId ?? null,
          i,
        ],
      );
    }
  }

  await createSection('HERO', 'Smart Gold, Everyday Shine', 1, [
    { heading: '9K gold set with real gemstones', ctaLabel: 'Shop Now', ctaUrl: '/rings' },
  ]);
  await createSection('BENTO_CATEGORIES', 'Shop by Category', 2, [
    { heading: 'Rings', ctaLabel: 'Shop Rings', categoryId: ids.rings },
    { heading: 'Earrings', ctaLabel: 'Shop Earrings', categoryId: ids.earrings },
    { heading: 'Pendants', ctaLabel: 'Shop Pendants', categoryId: ids.pendants },
  ]);
  await createSection('NEW_ARRIVALS', 'New Arrivals', 3, []);
  await createSection('COLLECTION_CARDS', 'Curated Collections', 4, [
    { heading: 'Everyday Gold', ctaLabel: 'Explore', collectionId: everydayId },
  ]);
  await createSection('FEATURED_PRODUCT', 'The Signature Piece', 5, []);
  await createSection('BEST_SELLERS', 'Most Loved', 6, []);
  await createSection('SHOP_BY_PRICE', 'Shop by Price', 7, [
    { heading: 'Under ₹10,000', ctaUrl: '/products?priceMax=10000' },
    { heading: '₹10,000 – ₹25,000', ctaUrl: '/products?priceMin=10000&priceMax=25000' },
    { heading: 'Above ₹25,000', ctaUrl: '/products?priceMin=25000' },
  ]);
  await createSection('OCCASION_CARDS', 'Shop by Occasion', 8, [
    { heading: 'Everyday', ctaUrl: '/products' },
    { heading: 'Gifting', ctaUrl: '/products' },
  ]);
  await createSection('INSTAGRAM', 'Inspiration', 9, [{ heading: '@9karet' }, { heading: '@9karet' }, { heading: '@9karet' }]);
  await createSection('NEWSLETTER', 'Stay in the Loop', 10, []);
  await createSection('TRUST_STRIP', null, 11, [
    { heading: 'BIS Hallmarked 9K Gold' },
    { heading: 'Free Insured Shipping' },
    { heading: 'Easy Returns' },
    { heading: 'Transparent Pricing' },
  ]);
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await seedReferenceData(client);
    await seedHomepage(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }

  try {
    await seedSampleProducts();
  } finally {
    await pool.end();
  }
  console.log('Seed complete.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
