import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { query } from '../../src/config/db.js';
import {
  adminReplaceWeightRules,
  adminUpdateVariant,
  adminBulkUpdateVariants,
  previewProductVariantPricing,
} from '../../src/services/productsService.js';

// Real integration tests against the dev DB (no mocking library exists in
// this test suite) — a disposable product+variant is created fresh so
// nothing here touches real catalog data, and the page_cache table (the
// actual SSR cache the app reads/writes) is used directly rather than
// spying on a function call, which more faithfully proves the fix: the
// cache row genuinely disappears after each of the three edit paths.

// The global 9K 'purity' attribute value (seeded by the
// 9karet_gold_and_stones migration) — looked up, since its id differs per
// database.
let PURITY_9K_ID;
before(async () => {
  const { rows } = await query(
    `SELECT av.id FROM attribute_values av JOIN attributes a ON a.id = av.attribute_id
     WHERE a.code = 'purity' AND av.value = '9K' AND av.product_id IS NULL`,
  );
  PURITY_9K_ID = rows[0]?.id;
  if (!PURITY_9K_ID) throw new Error('test requires the global 9K purity value (run migrations)');
});

async function createTestFixture(labelSuffix) {
  const { rows: categoryRows } = await query('SELECT id, slug FROM categories LIMIT 1');
  if (!categoryRows[0]) throw new Error('test requires at least one category in the dev DB');
  const { id: categoryId, slug: categorySlug } = categoryRows[0];

  const productId = randomUUID();
  const productSlug = `test-weight-precedence-${labelSuffix}-${productId.slice(0, 8)}`;
  const pdpUrl = `/${categorySlug}/${productSlug}`;

  await query(
    `INSERT INTO products (id, name, sku, category_id, metal_type, purity, gold_weight_grams, slug, status)
     VALUES ($1, $2, $3, $4, 'GOLD', '9K', 0.500, $5, 'PUBLISHED')`,
    [productId, `Test Weight Precedence Product ${labelSuffix}`, `TEST-SKU-${labelSuffix}-${productId.slice(0, 8)}`, categoryId, productSlug],
  );

  const { rows: sizeRows } = await query(
    `INSERT INTO attribute_values (attribute_id, product_id, value, label)
     SELECT id, $1, '6', '6' FROM attributes WHERE code = 'size'
     RETURNING id`,
    [productId],
  );
  const sizeValueId = sizeRows[0].id;

  await query(`INSERT INTO product_attribute_values (product_id, attribute_value_id) VALUES ($1, $2), ($1, $3)`, [
    productId,
    PURITY_9K_ID,
    sizeValueId,
  ]);

  // Seeded with a legacy variant-level weight (0.586g) distinct from the
  // product's base weight (0.5g) — matches the exact reported scenario.
  const { rows: variantRows } = await query(
    `INSERT INTO product_variants (product_id, gold_weight_grams, combination_key)
     VALUES ($1, 0.586, $2) RETURNING id`,
    [productId, [PURITY_9K_ID, sizeValueId].sort().join('|')],
  );
  const variantId = variantRows[0].id;
  await query(`INSERT INTO variant_attribute_values (variant_id, attribute_value_id) VALUES ($1, $2), ($1, $3)`, [
    variantId,
    PURITY_9K_ID,
    sizeValueId,
  ]);

  return { productId, variantId, pdpUrl };
}

async function destroyTestFixture({ productId, pdpUrl }) {
  await query('DELETE FROM products WHERE id = $1', [productId]); // cascades variants/attribute-values/weight-rules
  await query('DELETE FROM page_cache WHERE url = ANY($1)', [[pdpUrl, '/']]);
}

async function seedPageCache(pdpUrl) {
  await query('DELETE FROM page_cache WHERE url = ANY($1)', [[pdpUrl, '/']]);
  await query("INSERT INTO page_cache (url, html) VALUES ($1, '<html>stale</html>'), ($2, '<html>stale</html>')", [
    pdpUrl,
    '/',
  ]);
}

async function isPageCached(url) {
  const { rows } = await query('SELECT 1 FROM page_cache WHERE url = $1', [url]);
  return rows.length > 0;
}

describe('Weight Defaults / variant edits invalidate the SSR page cache (Test E)', () => {
  let fixture;

  before(async () => {
    fixture = await createTestFixture('e');
  });

  after(async () => {
    await destroyTestFixture(fixture);
  });

  beforeEach(async () => {
    await seedPageCache(fixture.pdpUrl);
  });

  test('adminReplaceWeightRules (Weight Defaults save) invalidates the cached PDP and home URLs', async () => {
    assert.equal(await isPageCached(fixture.pdpUrl), true, 'setup: page_cache should start seeded');
    await adminReplaceWeightRules(fixture.productId, {
      purityRules: [],
      puritySizeRules: [{ purity: '9K', sizeLabel: '6', goldWeightGrams: 0.256 }],
    });
    assert.equal(await isPageCached(fixture.pdpUrl), false, 'PDP page_cache row should be gone after saving Weight Defaults');
    assert.equal(await isPageCached('/'), false, 'home page_cache row should be gone too');
  });

  test('adminUpdateVariant invalidates the cached PDP URL', async () => {
    assert.equal(await isPageCached(fixture.pdpUrl), true, 'setup: page_cache should start seeded');
    await adminUpdateVariant(fixture.productId, fixture.variantId, { stockQuantity: 5 });
    assert.equal(await isPageCached(fixture.pdpUrl), false, 'PDP page_cache row should be gone after a direct variant edit');
  });

  test('adminBulkUpdateVariants invalidates the cached PDP URL', async () => {
    assert.equal(await isPageCached(fixture.pdpUrl), true, 'setup: page_cache should start seeded');
    await adminBulkUpdateVariants(fixture.productId, [fixture.variantId], { stockQuantity: 7 });
    assert.equal(await isPageCached(fixture.pdpUrl), false, 'PDP page_cache row should be gone after a bulk variant edit');
  });
});

describe('Immediate storefront correctness after a Weight Defaults save (Test F)', () => {
  let fixture;

  before(async () => {
    fixture = await createTestFixture('f');
  });

  after(async () => {
    await destroyTestFixture(fixture);
  });

  test('changing 9K+Size6 from 0.600g to 0.256g and saving is reflected on the very next price-preview call', async () => {
    // Start the rule at 0.600g (distinct from both the variant's legacy
    // 0.586g and the product's base 0.500g, so any of the three sources
    // being read instead of the fresh save would fail this assertion).
    await adminReplaceWeightRules(fixture.productId, {
      purityRules: [],
      puritySizeRules: [{ purity: '9K', sizeLabel: '6', goldWeightGrams: 0.6 }],
    });
    const pricingBeforeChange = await previewProductVariantPricing(fixture.productId, { variantId: fixture.variantId });
    assert.equal(pricingBeforeChange.goldWeightGrams, 0.6);

    await adminReplaceWeightRules(fixture.productId, {
      purityRules: [],
      puritySizeRules: [{ purity: '9K', sizeLabel: '6', goldWeightGrams: 0.256 }],
    });
    const pricingAfterChange = await previewProductVariantPricing(fixture.productId, { variantId: fixture.variantId });
    assert.equal(
      pricingAfterChange.goldWeightGrams,
      0.256,
      'the very next price-preview call must reflect the new rule immediately',
    );
    assert.notEqual(
      pricingAfterChange.sellingPrice,
      pricingBeforeChange.sellingPrice,
      'price must be recalculated, not reused from before the save',
    );
  });
});
