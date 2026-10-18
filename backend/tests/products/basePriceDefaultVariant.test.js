import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { query } from '../../src/config/db.js';
import {
  adminReplaceWeightRules,
  previewProductVariantPricing,
} from '../../src/services/productsService.js';
import { findGoldProductsForRecalculation } from '../../src/repositories/products.repository.js';

// Real integration tests against the dev DB, mirroring weightRulesCacheInvalidation.test.js's
// fixture style — proves the two bugs behind the PLP-vs-PDP price mismatch
// (buildBaseConfigVariant ignoring size; findGoldProductsForRecalculation
// excluding weight-rules-only products) are actually fixed, not just the
// cache-invalidation *timing* those existing tests already cover.

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

async function createTestFixture(labelSuffix, { flatGoldWeightGrams } = {}) {
  const { rows: categoryRows } = await query('SELECT id, slug FROM categories LIMIT 1');
  if (!categoryRows[0]) throw new Error('test requires at least one category in the dev DB');
  const { id: categoryId, slug: categorySlug } = categoryRows[0];

  const productId = randomUUID();
  const productSlug = `test-base-default-variant-${labelSuffix}-${productId.slice(0, 8)}`;
  const pdpUrl = `/${categorySlug}/${productSlug}`;

  await query(
    `INSERT INTO products (id, name, sku, category_id, metal_type, purity, gold_weight_grams, slug, status)
     VALUES ($1, $2, $3, $4, 'GOLD', '9K', $5, $6, 'PUBLISHED')`,
    [
      productId,
      `Test Base Default Variant Product ${labelSuffix}`,
      `TEST-BDV-SKU-${labelSuffix}-${productId.slice(0, 8)}`,
      categoryId,
      flatGoldWeightGrams ?? null,
      productSlug,
    ],
  );

  // Two sizes — "6" (smallest, the PDP/useVariantSelection default) and "8".
  const { rows: size6Rows } = await query(
    `INSERT INTO attribute_values (attribute_id, product_id, value, label)
     SELECT id, $1, '6', '6' FROM attributes WHERE code = 'size'
     RETURNING id`,
    [productId],
  );
  const size6Id = size6Rows[0].id;
  const { rows: size8Rows } = await query(
    `INSERT INTO attribute_values (attribute_id, product_id, value, label)
     SELECT id, $1, '8', '8' FROM attributes WHERE code = 'size'
     RETURNING id`,
    [productId],
  );
  const size8Id = size8Rows[0].id;

  await query(
    `INSERT INTO product_attribute_values (product_id, attribute_value_id) VALUES ($1, $2), ($1, $3), ($1, $4)`,
    [productId, PURITY_9K_ID, size6Id, size8Id],
  );

  const { rows: variant6Rows } = await query(
    `INSERT INTO product_variants (product_id, combination_key) VALUES ($1, $2) RETURNING id`,
    [productId, [PURITY_9K_ID, size6Id].sort().join('|')],
  );
  const variant6Id = variant6Rows[0].id;
  await query(`INSERT INTO variant_attribute_values (variant_id, attribute_value_id) VALUES ($1, $2), ($1, $3)`, [
    variant6Id,
    PURITY_9K_ID,
    size6Id,
  ]);

  return { productId, variant6Id, size6Id, size8Id, pdpUrl };
}

async function destroyTestFixture({ productId, pdpUrl }) {
  await query('DELETE FROM products WHERE id = $1', [productId]); // cascades variants/attribute-values/weight-rules
  await query('DELETE FROM page_cache WHERE url = ANY($1)', [[pdpUrl, '/']]);
}

describe('Base cached price resolves the PDP\'s exact default variant (Case 2)', () => {
  let fixture;

  before(async () => {
    // No flat gold_weight_grams at all — relies entirely on Weight Defaults,
    // same shape as the real product (Incantevole) that surfaced this bug.
    fixture = await createTestFixture('case2', { flatGoldWeightGrams: null });
  });

  after(async () => {
    await destroyTestFixture(fixture);
  });

  test('cached selling_price matches the smallest size\'s rule, not the purity-only rule', async () => {
    // Purity-only rule (2.000g) is deliberately different from BOTH
    // size-specific rules, so any of the three being used instead of the
    // smallest size's rule (1.500g) fails this assertion.
    await adminReplaceWeightRules(fixture.productId, {
      purityRules: [{ purity: '9K', goldWeightGrams: 2.0 }],
      puritySizeRules: [
        { purity: '9K', sizeLabel: '6', goldWeightGrams: 1.5 },
        { purity: '9K', sizeLabel: '8', goldWeightGrams: 1.8 },
      ],
    });

    const { rows } = await query('SELECT selling_price FROM products WHERE id = $1', [fixture.productId]);
    const cachedSellingPrice = Number(rows[0].selling_price);

    const pdpPricingForSize6 = await previewProductVariantPricing(fixture.productId, {
      variantId: fixture.variant6Id,
    });

    assert.equal(
      cachedSellingPrice,
      pdpPricingForSize6.sellingPrice,
      'PLP cached price must equal the PDP price for the default (smallest) size',
    );

    // Sanity check the fixture itself: the purity-only rule (2.000g) really
    // would have produced a different price, proving this test can actually
    // catch a regression back to "no size resolved at all".
    const goldValueAtPurityOnlyWeight = (2.0 / 1.5) * pdpPricingForSize6.goldValue;
    assert.notEqual(
      Math.round(goldValueAtPurityOnlyWeight * 100) / 100,
      pdpPricingForSize6.goldValue,
      'sanity check: the purity-only weight must genuinely differ from size 6\'s weight',
    );
  });
});

describe('Scheduled recalculation includes weight-rules-only gold products (Case: recalculation query)', () => {
  let fixture;

  before(async () => {
    fixture = await createTestFixture('recalc', { flatGoldWeightGrams: null });
    await adminReplaceWeightRules(fixture.productId, {
      purityRules: [{ purity: '9K', goldWeightGrams: 1.95 }],
      puritySizeRules: [],
    });
  });

  after(async () => {
    await destroyTestFixture(fixture);
  });

  test('a product with no flat gold_weight_grams still appears in findGoldProductsForRecalculation', async () => {
    const products = await findGoldProductsForRecalculation();
    const found = products.some((p) => p.id === fixture.productId);
    assert.equal(
      found,
      true,
      'a gold product priced entirely via Weight Defaults rules must still be picked up by the nightly gold-rate-sync recalculation',
    );
  });
});
