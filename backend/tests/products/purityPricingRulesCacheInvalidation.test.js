import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { query } from '../../src/config/db.js';
import { adminReplacePurityPricingRules, previewProductVariantPricing } from '../../src/services/productsService.js';

// Real integration test against the dev DB (no mocking library exists in
// this test suite), mirroring weightRulesCacheInvalidation.test.js — proves
// saving a Purity Pricing Rule invalidates the same SSR page_cache rows a
// Weight Defaults save does, via the same safeInvalidateProductPages path.

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
  const productSlug = `test-purity-pricing-${labelSuffix}-${productId.slice(0, 8)}`;
  const pdpUrl = `/${categorySlug}/${productSlug}`;

  await query(
    `INSERT INTO products (id, name, sku, category_id, metal_type, purity, gold_weight_grams, slug, status, making_charge_percent)
     VALUES ($1, $2, $3, $4, 'GOLD', '9K', 0.500, $5, 'PUBLISHED', 40)`,
    [productId, `Test Purity Pricing Product ${labelSuffix}`, `TEST-PP-SKU-${labelSuffix}-${productId.slice(0, 8)}`, categoryId, productSlug],
  );

  await query(`INSERT INTO product_attribute_values (product_id, attribute_value_id) VALUES ($1, $2)`, [
    productId,
    PURITY_9K_ID,
  ]);

  const { rows: variantRows } = await query(
    `INSERT INTO product_variants (product_id, combination_key) VALUES ($1, $2) RETURNING id`,
    [productId, PURITY_9K_ID],
  );
  const variantId = variantRows[0].id;
  await query(`INSERT INTO variant_attribute_values (variant_id, attribute_value_id) VALUES ($1, $2)`, [
    variantId,
    PURITY_9K_ID,
  ]);

  return { productId, variantId, pdpUrl };
}

async function destroyTestFixture({ productId, pdpUrl }) {
  await query('DELETE FROM products WHERE id = $1', [productId]); // cascades variants/attribute-values/purity-pricing-rules
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

describe('Purity Pricing Rules save invalidates the SSR page cache (Test G)', () => {
  let fixture;

  before(async () => {
    fixture = await createTestFixture('g');
  });

  after(async () => {
    await destroyTestFixture(fixture);
  });

  beforeEach(async () => {
    await seedPageCache(fixture.pdpUrl);
  });

  test('adminReplacePurityPricingRules invalidates the cached PDP and home URLs', async () => {
    assert.equal(await isPageCached(fixture.pdpUrl), true, 'setup: page_cache should start seeded');
    await adminReplacePurityPricingRules(fixture.productId, {
      purityPricingRules: [{ purityValueId: PURITY_9K_ID, makingChargePercent: 60, makingChargeDiscountPercent: 10, stoneDiscountPercent: 5 }],
    });
    assert.equal(await isPageCached(fixture.pdpUrl), false, 'PDP page_cache row should be gone after saving Purity Pricing Rules');
    assert.equal(await isPageCached('/'), false, 'home page_cache row should be gone too');
  });

  test('the very next price-preview call after saving reflects the new making charge percent immediately', async () => {
    await adminReplacePurityPricingRules(fixture.productId, {
      purityPricingRules: [{ purityValueId: PURITY_9K_ID, makingChargePercent: 60, makingChargeDiscountPercent: null, stoneDiscountPercent: null }],
    });
    const before9k = await previewProductVariantPricing(fixture.productId, { variantId: fixture.variantId });
    const expectedBefore = Math.round(before9k.goldValue * 0.6 * 100) / 100;
    assert.equal(before9k.makingChargeOriginal, expectedBefore);

    await adminReplacePurityPricingRules(fixture.productId, {
      purityPricingRules: [{ purityValueId: PURITY_9K_ID, makingChargePercent: 70, makingChargeDiscountPercent: null, stoneDiscountPercent: null }],
    });
    const after9k = await previewProductVariantPricing(fixture.productId, { variantId: fixture.variantId });
    const expectedAfter = Math.round(after9k.goldValue * 0.7 * 100) / 100;
    assert.equal(after9k.makingChargeOriginal, expectedAfter, 'the very next price-preview call must reflect the new rule immediately');
    assert.notEqual(after9k.makingChargeOriginal, before9k.makingChargeOriginal);
  });
});
