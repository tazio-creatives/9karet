import { test, describe, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../src/config/db.js';
import { adminCreateProduct, adminUpdateProduct, adminDeleteProduct } from '../../src/services/productsService.js';
import { createProductSchema, updateProductSchema } from '../../src/validators/products.validators.js';

// Real integration test against the dev DB (no mocking library exists in
// this test suite) — proves the combined product create/edit save: stones,
// Weight Defaults and Purity Pricing Rules entered in the SAME create/update
// call as the main product fields, resolved server-side from purity codes/
// size labels (never a database UUID) and persisted atomically in the
// product's withTransaction — no separate save-and-reopen step.

async function testCategory() {
  const { rows } = await query('SELECT id, slug FROM categories LIMIT 1');
  if (!rows[0]) throw new Error('test requires at least one category in the dev DB (npm run seed)');
  return rows[0];
}

let ruby;
let cz;
before(async () => {
  const { rows } = await query(`SELECT id, slug FROM stone_types WHERE slug IN ('ruby', 'cubic-zirconia')`);
  ruby = rows.find((r) => r.slug === 'ruby')?.id;
  cz = rows.find((r) => r.slug === 'cubic-zirconia')?.id;
  if (!ruby || !cz) throw new Error('test requires the Ruby and Cubic Zirconia stone types (seeded by migration)');
});

function basePayload(overrides = {}) {
  return {
    name: `Combined Save Test ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sku: `TEST-COMBINED-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    goldWeightGrams: 1,
    makingChargePercent: 10,
    status: 'DRAFT',
    ...overrides,
  };
}

const createdProductIds = [];
after(async () => {
  for (const id of createdProductIds) {
    await adminDeleteProduct(id).catch(() => {});
  }
});

async function productRow(id) {
  const { rows } = await query(
    `SELECT metal_type, purity, gold_value, stone_value, stone_weight_carats, making_charge,
            selling_price, gross_weight_grams, net_weight_grams
     FROM products WHERE id = $1`,
    [id],
  );
  return rows[0];
}

async function stoneRows(id) {
  const { rows } = await query(
    `SELECT st.slug, ps.stone_count, ps.weight_carats, ps.price
     FROM product_stones ps JOIN stone_types st ON st.id = ps.stone_type_id
     WHERE ps.product_id = $1 ORDER BY ps.sort_order`,
    [id],
  );
  return rows;
}

describe('Combined product save — create', () => {
  test('creates the product as 9K gold with its stones, variants, weight rules and purity pricing rules atomically', async () => {
    const category = await testCategory();
    const input = createProductSchema.parse(
      basePayload({
        categoryId: category.id,
        goldWeightGrams: 2,
        sizes: [
          { label: '6', stockQuantity: 5 },
          { label: '12', stockQuantity: 7 },
        ],
        weightRules: {
          purityRules: [{ purity: '9K', goldWeightGrams: 0.54 }],
          puritySizeRules: [{ purity: '9K', sizeLabel: '6', goldWeightGrams: 0.5 }],
        },
        purityPricingRules: [{ purity: '9K', makingChargePercent: 20, makingChargeDiscountPercent: 10, stoneDiscountPercent: null }],
        stones: [
          { stoneTypeId: ruby, count: 1, weightCarats: 0.3, price: 2400 },
          { stoneTypeId: cz, count: 12, weightCarats: 0.25, price: 360 },
        ],
      }),
    );

    const product = await adminCreateProduct(input);
    createdProductIds.push(product.id);

    const row = await productRow(product.id);
    assert.equal(row.metal_type, 'GOLD');
    assert.equal(row.purity, '9K', 'purity is always 9K, never chosen by the form');
    assert.equal(Number(row.stone_value), 2760, 'stone value = sum of the stone prices');
    assert.equal(Number(row.stone_weight_carats), 0.55);
    assert.equal(Number(row.net_weight_grams), 2);
    assert.equal(Number(row.gross_weight_grams), 2.11, 'gross = 2 g gold + 0.55 ct x 0.2 g');

    assert.deepEqual(
      (await stoneRows(product.id)).map((s) => [s.slug, s.stone_count, Number(s.weight_carats), Number(s.price)]),
      [
        ['ruby', 1, 0.3, 2400],
        ['cubic-zirconia', 12, 0.25, 360],
      ],
    );
    assert.equal(product.stones.length, 2, 'the save response carries the saved stones');

    const { rows: weightRows } = await query(
      `SELECT pav.value AS purity, sav.value AS size_label, r.gold_weight_grams
       FROM product_weight_rules r
       JOIN attribute_values pav ON pav.id = r.purity_value_id
       LEFT JOIN attribute_values sav ON sav.id = r.size_value_id
       WHERE r.product_id = $1 ORDER BY sav.value NULLS FIRST`,
      [product.id],
    );
    assert.equal(weightRows.length, 2, 'expected 1 purity-only rule + 1 purity+size rule');
    assert.equal(Number(weightRows.find((r) => r.size_label === null).gold_weight_grams), 0.54);
    assert.equal(Number(weightRows.find((r) => r.size_label === '6').gold_weight_grams), 0.5);

    const { rows: pricingRows } = await query(
      `SELECT r.making_charge_percent, r.making_charge_discount_percent, r.stone_discount_percent
       FROM product_purity_pricing_rules r WHERE r.product_id = $1`,
      [product.id],
    );
    assert.equal(pricingRows.length, 1);
    assert.equal(Number(pricingRows[0].making_charge_percent), 20);
    assert.equal(Number(pricingRows[0].making_charge_discount_percent), 10);
    assert.equal(pricingRows[0].stone_discount_percent, null, 'explicit null must stay null, not fall back to 0');

    const { rows: variantRows } = await query('SELECT id FROM product_variants WHERE product_id = $1', [product.id]);
    assert.equal(variantRows.length, 2, '9K x 2 sizes = 2 variants');
  });

  test('an internal failure (unresolvable size) rolls back the ENTIRE create — no orphaned product or stones', async () => {
    const category = await testCategory();
    const name = `Combined Save Rollback Test ${Date.now()}`;
    // `sizes` is deliberately omitted — the schema's checkAxisMembership only
    // cross-checks puritySizeRules against `sizes` when `sizes` is present,
    // so this reaches adminCreateProduct unrejected and the service-layer
    // resolver's own 409 (inside the transaction) has to catch it.
    const input = createProductSchema.parse(
      basePayload({
        name,
        categoryId: category.id,
        weightRules: { purityRules: [], puritySizeRules: [{ purity: '9K', sizeLabel: '99', goldWeightGrams: 1 }] },
        stones: [{ stoneTypeId: ruby, count: 1, weightCarats: 0.1, price: 500 }],
      }),
    );

    await assert.rejects(() => adminCreateProduct(input));

    const { rows } = await query('SELECT id FROM products WHERE name = $1', [name]);
    assert.equal(rows.length, 0, 'the product row itself must not exist after a rolled-back create');
  });
});

describe('Combined product save — update', () => {
  async function createBaseProduct(category) {
    const input = createProductSchema.parse(
      basePayload({
        categoryId: category.id,
        sizes: [
          { label: '6', stockQuantity: 1 },
          { label: '8', stockQuantity: 1 },
        ],
        weightRules: {
          purityRules: [{ purity: '9K', goldWeightGrams: 0.5 }],
          puritySizeRules: [{ purity: '9K', sizeLabel: '8', goldWeightGrams: 0.7 }],
        },
        purityPricingRules: [{ purity: '9K', makingChargePercent: 15, makingChargeDiscountPercent: 5, stoneDiscountPercent: null }],
        stones: [{ stoneTypeId: ruby, count: 1, weightCarats: 0.3, price: 2400 }],
      }),
    );
    const product = await adminCreateProduct(input);
    createdProductIds.push(product.id);
    return product;
  }

  test('an unrelated field update preserves saved rules and stones', async () => {
    const product = await createBaseProduct(await testCategory());

    const patch = updateProductSchema.parse({ shortDescription: 'unrelated edit, no rule fields sent' });
    assert.equal('weightRules' in patch, false);
    assert.equal('purityPricingRules' in patch, false);
    assert.equal('stones' in patch, false);
    await adminUpdateProduct(product.id, patch);

    const { rows: weightRows } = await query('SELECT id FROM product_weight_rules WHERE product_id = $1', [product.id]);
    assert.equal(weightRows.length, 2, 'weight rules must survive an unrelated update');
    const { rows: pricingRows } = await query('SELECT id FROM product_purity_pricing_rules WHERE product_id = $1', [
      product.id,
    ]);
    assert.equal(pricingRows.length, 1, 'purity pricing rule must survive an unrelated update');
    assert.equal((await stoneRows(product.id)).length, 1, 'stones must survive an unrelated update');
  });

  test('sending stones replaces the list and reprices; an empty list removes them', async () => {
    const product = await createBaseProduct(await testCategory());

    await adminUpdateProduct(
      product.id,
      updateProductSchema.parse({
        stones: [
          { stoneTypeId: cz, count: 20, weightCarats: 0.4, price: 600 },
          { stoneTypeId: ruby, count: 2, weightCarats: 0.5, price: 4100 },
        ],
      }),
    );
    let row = await productRow(product.id);
    assert.deepEqual(
      (await stoneRows(product.id)).map((s) => s.slug),
      ['cubic-zirconia', 'ruby'],
    );
    assert.equal(Number(row.stone_value), 4700);
    assert.equal(Number(row.stone_weight_carats), 0.9);
    assert.equal(Number(row.gross_weight_grams), 1.18, 'gross = 1 g gold + 0.9 ct x 0.2 g');

    await adminUpdateProduct(product.id, updateProductSchema.parse({ stones: [] }));
    row = await productRow(product.id);
    assert.equal((await stoneRows(product.id)).length, 0);
    assert.equal(Number(row.stone_value), 0);
    assert.equal(row.stone_weight_carats, null);
    assert.equal(Number(row.gross_weight_grams), 1);
  });

  test('an explicitly empty weightRules/purityPricingRules clears the saved rules', async () => {
    const product = await createBaseProduct(await testCategory());

    await adminUpdateProduct(
      product.id,
      updateProductSchema.parse({ weightRules: { purityRules: [], puritySizeRules: [] }, purityPricingRules: [] }),
    );

    const { rows: weightRows } = await query('SELECT id FROM product_weight_rules WHERE product_id = $1', [product.id]);
    assert.equal(weightRows.length, 0, 'an explicit empty weightRules must clear the saved rules');
    const { rows: pricingRows } = await query('SELECT id FROM product_purity_pricing_rules WHERE product_id = $1', [
      product.id,
    ]);
    assert.equal(pricingRows.length, 0, 'an explicit empty purityPricingRules must clear the saved rules');
  });

  test('removing a size prunes its now-orphaned purity+size weight rule', async () => {
    const product = await createBaseProduct(await testCategory());

    // Drop size 8, keep size 6 — no weightRules field sent at all, proving
    // pruning happens purely from the axis change.
    await adminUpdateProduct(product.id, updateProductSchema.parse({ sizes: [{ label: '6', stockQuantity: 1 }] }));

    const { rows: weightRows } = await query(
      `SELECT sav.value AS size_label FROM product_weight_rules r
       LEFT JOIN attribute_values sav ON sav.id = r.size_value_id WHERE r.product_id = $1`,
      [product.id],
    );
    assert.deepEqual(
      weightRows.map((r) => r.size_label),
      [null],
      'only the purity-only rule should remain once size 8 is removed',
    );
    const { rows: variantRows } = await query('SELECT id FROM product_variants WHERE product_id = $1', [product.id]);
    assert.equal(variantRows.length, 1);
  });
});

describe('applyBaseProductPricing — cached breakdown stays internally consistent', () => {
  // Regression: the admin form submits `sellingPrice`/`makingCharge` as
  // plain fields alongside purityPricingRules on every save. A request can
  // write a `making_charge` inconsistent with the `selling_price` it also
  // writes; the "unchanged" short-circuit must still correct it rather than
  // leave the stored breakdown permanently wrong.
  test('a request that writes an inconsistent making_charge alongside an already-correct sellingPrice still gets corrected', async () => {
    const product = await adminCreateProduct(
      createProductSchema.parse(
        basePayload({
          makingChargePercent: 0, // product's own base default: no making charge
          purityPricingRules: [{ purity: '9K', makingChargePercent: 20, makingChargeDiscountPercent: 0, stoneDiscountPercent: 0 }],
        }),
      ),
    );
    createdProductIds.push(product.id);

    const before = await productRow(product.id);
    const correctMakingCharge = Number(before.making_charge);
    const correctSellingPrice = Number(before.selling_price);
    assert.ok(correctMakingCharge > 0, 'sanity check: the 20% purity rule must have produced a non-zero making charge');

    await adminUpdateProduct(product.id, updateProductSchema.parse({ sellingPrice: correctSellingPrice, makingCharge: 0 }));

    const afterRow = await productRow(product.id);
    assert.equal(Number(afterRow.making_charge), correctMakingCharge, 'making_charge must be corrected back');
    assert.equal(Number(afterRow.selling_price), correctSellingPrice);
  });
});

describe('Combined product save — validator-level checks', () => {
  test('rejects any purity other than 9K', () => {
    assert.throws(() =>
      createProductSchema.parse(
        basePayload({ weightRules: { purityRules: [{ purity: '18K', goldWeightGrams: 1 }], puritySizeRules: [] } }),
      ),
    );
  });

  test('rejects duplicate purities within weightRules.purityRules', () => {
    assert.throws(() =>
      createProductSchema.parse(
        basePayload({
          weightRules: {
            purityRules: [
              { purity: '9K', goldWeightGrams: 1 },
              { purity: '9K', goldWeightGrams: 2 },
            ],
            puritySizeRules: [],
          },
        }),
      ),
    );
  });

  test('rejects duplicate purities within purityPricingRules', () => {
    assert.throws(() =>
      createProductSchema.parse(
        basePayload({
          purityPricingRules: [
            { purity: '9K', makingChargePercent: 10, makingChargeDiscountPercent: null, stoneDiscountPercent: null },
            { purity: '9K', makingChargePercent: 20, makingChargeDiscountPercent: null, stoneDiscountPercent: null },
          ],
        }),
      ),
    );
  });

  test('rejects a purity-pricing percent outside 0-100', () => {
    assert.throws(() =>
      createProductSchema.parse(
        basePayload({
          purityPricingRules: [{ purity: '9K', makingChargePercent: 150, makingChargeDiscountPercent: null, stoneDiscountPercent: null }],
        }),
      ),
    );
  });

  test('rejects a purity+size weight rule whose size is not in the same request\'s sizes', () => {
    assert.throws(() =>
      createProductSchema.parse(
        basePayload({
          sizes: [{ label: '6', stockQuantity: 1 }],
          weightRules: { purityRules: [], puritySizeRules: [{ purity: '9K', sizeLabel: '8', goldWeightGrams: 1 }] },
        }),
      ),
    );
  });

  test('rejects a gold weight of zero', () => {
    assert.throws(() =>
      createProductSchema.parse(
        basePayload({ weightRules: { purityRules: [{ purity: '9K', goldWeightGrams: 0 }], puritySizeRules: [] } }),
      ),
    );
  });

  test('rejects a stone line with zero weight, zero count or a negative price', () => {
    const stoneTypeId = '00000000-0000-4000-8000-000000000000';
    for (const bad of [
      { stoneTypeId, count: 1, weightCarats: 0, price: 100 },
      { stoneTypeId, count: 0, weightCarats: 0.1, price: 100 },
      { stoneTypeId, count: 1, weightCarats: 0.1, price: -1 },
    ]) {
      assert.throws(() => createProductSchema.parse(basePayload({ stones: [bad] })), JSON.stringify(bad));
    }
  });

  test('accepts an explicit 0 for makingChargeDiscountPercent (distinct from omitted/null)', () => {
    const parsed = createProductSchema.parse(
      basePayload({
        purityPricingRules: [{ purity: '9K', makingChargePercent: 10, makingChargeDiscountPercent: 0, stoneDiscountPercent: null }],
      }),
    );
    assert.equal(parsed.purityPricingRules[0].makingChargeDiscountPercent, 0);
    assert.equal(parsed.purityPricingRules[0].stoneDiscountPercent, null);
  });

  test('updateProductSchema.partial() still allows omitting weightRules/purityPricingRules/stones entirely', () => {
    const parsed = updateProductSchema.parse({ shortDescription: 'no rule fields at all' });
    assert.equal('weightRules' in parsed, false);
    assert.equal('purityPricingRules' in parsed, false);
    assert.equal('stones' in parsed, false);
  });
});
