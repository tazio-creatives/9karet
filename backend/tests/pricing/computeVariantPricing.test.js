import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeVariantPricing,
  computeSellingPrice,
  computeStoneValue,
  computeStoneWeightCarats,
} from '../../src/services/pricingService.js';
import { getCurrentGoldRate } from '../../src/repositories/goldRates.repository.js';

// Base product with a cached gold_value — mirrors a row as it comes back
// from lockProductForCheckoutTx/findProductById. `stones` is attached
// directly (as the batch paths do) so these tests don't need product_stones
// rows in the DB; only the live 9K gold-rate lookup hits it.
const baseProduct = {
  id: '00000000-0000-4000-8000-000000000001', // valid UUID, matches no product
  metal_type: 'GOLD',
  purity: '9K',
  net_weight_grams: '10.000',
  gold_weight_grams: '10.000',
  gold_value: 30000,
  stone_value: 0,
  making_charge: 5000,
  gst_percent: 3,
  stones: [],
};

const RUBY = 'type-ruby';
const CZ = 'type-cz';

function stoneRow({ id, typeId, typeName, count = 1, carats, price }) {
  return {
    id,
    stone_type_id: typeId,
    stone_type_name: typeName,
    stone_count: count,
    weight_carats: String(carats),
    price: String(price),
  };
}

const rubyAndCz = [
  stoneRow({ id: 's-ruby', typeId: RUBY, typeName: 'Ruby', carats: 0.3, price: 2400 }),
  stoneRow({ id: 's-cz', typeId: CZ, typeName: 'Cubic Zirconia', count: 12, carats: 0.24, price: 360 }),
];

// Builds a variant row shaped like productVariants.repository.js's
// findVariantById/findVariantsByProductId output (resolvedPurity etc. read
// from `.attributes`), for a variant that only overrides what's passed.
function makeVariant({ purity, goldColor, goldWeightGrams, priceOverride, sizeValueId, sizeLabel } = {}) {
  const attributes = {};
  if (purity) attributes.purity = { valueId: 'v-purity', value: purity, label: purity, refId: null };
  if (goldColor) attributes.gold_color = { valueId: 'v-color', value: goldColor, label: goldColor, refId: null };
  if (sizeValueId) {
    attributes.size = { valueId: sizeValueId, value: sizeLabel ?? sizeValueId, label: sizeLabel ?? sizeValueId, refId: null };
  }
  return {
    gold_weight_grams: goldWeightGrams ?? null,
    price_override: priceOverride ?? null,
    combination_key: Object.keys(attributes).length ? 'x' : '',
    attributes,
  };
}

async function rate9k() {
  const rate = await getCurrentGoldRate('9K');
  assert.ok(rate, 'test requires a 9K gold rate in the dev DB (npm run seed)');
  return Number(rate.rate_per_gram);
}

const goldAt = (grams, rate) => Math.round(grams * rate * 100) / 100;

function stoneRule({ id = 'r-stone', stoneTypeIds = [], discountType = 'PERCENT', discountValue, conditions = [] }) {
  return {
    id,
    name: `rule ${id}`,
    rule_type: 'STONE',
    scope: 'GLOBAL',
    discount_type: discountType,
    discount_value: discountValue,
    purity_scope: 'ALL',
    override_mode: 'PRESERVE',
    priority: 0,
    created_at: new Date().toISOString(),
    purityValueIds: new Set(),
    stoneTypeIds: new Set(stoneTypeIds),
    conditions,
  };
}

function ruleSetWith({ stoneGlobal = [], makingGlobal = [] } = {}) {
  return {
    makingByProduct: new Map(),
    makingByCategory: new Map(),
    makingGlobal,
    stoneByProduct: new Map(),
    stoneByCategory: new Map(),
    stoneGlobal,
  };
}

describe('computeVariantPricing — gold weight', () => {
  test('no variant at all (synthetic default) -> reuses cached gold_value, no DB call', async () => {
    const result = await computeVariantPricing(baseProduct, null);
    assert.equal(result.goldValue, 30000);
    assert.equal(result.purity, '9K');
  });

  test('variant with no overrides at all -> recomputed live off the base weight, not the cached column', async () => {
    const rate = await rate9k();
    const result = await computeVariantPricing(baseProduct, makeVariant({}));
    assert.equal(result.goldValue, goldAt(10, rate));
  });

  test('variant weight override -> recomputes goldValue off the variant weight', async () => {
    const rate = await rate9k();
    const result = await computeVariantPricing(baseProduct, makeVariant({ goldWeightGrams: 15 }));
    assert.equal(result.goldValue, goldAt(15, rate));
    assert.notEqual(result.goldValue, 30000);
  });

  test('a Gold Color-only variant can carry its own weight override too', async () => {
    const rate = await rate9k();
    const result = await computeVariantPricing(baseProduct, makeVariant({ goldColor: 'ROSE', goldWeightGrams: 11 }));
    assert.equal(result.goldColor, 'ROSE');
    assert.equal(result.goldValue, goldAt(11, rate));
  });
});

describe('computeVariantPricing — making_charge_percent (live making charge)', () => {
  test('no making_charge_percent set -> uses the flat making_charge column', async () => {
    const result = await computeVariantPricing(baseProduct, null);
    assert.equal(result.makingCharge, 5000);
  });

  test('making_charge_percent set -> making charge is that % of goldValue, not the flat column', async () => {
    const result = await computeVariantPricing({ ...baseProduct, making_charge_percent: 10 }, null);
    assert.equal(result.makingCharge, 3000); // 10% of 30000, not the flat 5000
  });

  test('making_charge_percent + a variant weight override -> making charge scales with the recomputed goldValue', async () => {
    const rate = await rate9k();
    const goldValue = goldAt(15, rate);
    const result = await computeVariantPricing({ ...baseProduct, making_charge_percent: 10 }, makeVariant({ goldWeightGrams: 15 }));
    assert.equal(result.goldValue, goldValue);
    assert.equal(result.makingCharge, Math.round(goldValue * 0.1 * 100) / 100);
  });

  test('making_charge_percent set but goldValue is 0 (no weight yet) -> falls back to flat making_charge', async () => {
    const result = await computeVariantPricing({ ...baseProduct, making_charge_percent: 10, gold_value: 0 }, null);
    assert.equal(result.goldValue, 0);
    assert.equal(result.makingCharge, 5000);
  });
});

describe('computeVariantPricing — stones', () => {
  test('stone value is the sum of the stone lines\' prices; weight is the sum of their carats', async () => {
    const result = await computeVariantPricing({ ...baseProduct, stones: rubyAndCz }, null);
    assert.equal(result.stoneValue, 2760);
    assert.equal(result.stoneWeightCarats, 0.54);
    assert.equal(result.stoneComponents.length, 2);
    assert.deepEqual(
      result.stoneComponents.map((c) => [c.stoneTypeName, c.count, c.carats, c.value]),
      [
        ['Ruby', 1, 0.3, 2400],
        ['Cubic Zirconia', 12, 0.24, 360],
      ],
    );
  });

  test('stones add to the price before GST: (gold + stones + making) x 1.03', async () => {
    const result = await computeVariantPricing({ ...baseProduct, stones: rubyAndCz }, null);
    assert.equal(result.sellingPrice, computeSellingPrice({ goldValue: 30000, stoneValue: 2760, makingCharge: 5000, gstPercent: 3 }));
    assert.equal(result.gstAmount, Math.round((30000 + 2760 + 5000) * 0.03 * 100) / 100);
  });

  test('stone value does not move with the gold weight/rate', async () => {
    const product = { ...baseProduct, stones: rubyAndCz };
    const light = await computeVariantPricing(product, makeVariant({ goldWeightGrams: 2 }));
    const heavy = await computeVariantPricing(product, makeVariant({ goldWeightGrams: 20 }));
    assert.equal(light.stoneValue, heavy.stoneValue);
  });

  test('a product with no stones prices as plain gold', async () => {
    const result = await computeVariantPricing(baseProduct, null);
    assert.equal(result.stoneValue, 0);
    assert.equal(result.stoneWeightCarats, null);
    assert.deepEqual(result.stoneComponents, []);
  });

  test('flat product stone discount % applies to the whole stone value', async () => {
    const result = await computeVariantPricing({ ...baseProduct, stones: rubyAndCz, stone_discount_percent: 10 }, null);
    assert.equal(result.stoneValueOriginal, 2760);
    assert.equal(result.stoneValue, 2484);
    assert.equal(result.stoneDiscountPercent, 10);
    assert.equal(result.stoneDiscountAmount, 276);
  });

  test('computeStoneValue/computeStoneWeightCarats accept the admin form\'s camelCase shape too', () => {
    const formStones = [
      { stoneTypeId: RUBY, count: 1, weightCarats: 0.25, price: 1999.5 },
      { stoneTypeId: CZ, count: 4, weightCarats: 0.1, price: 200 },
    ];
    assert.equal(computeStoneValue(formStones), 2199.5);
    assert.equal(computeStoneWeightCarats(formStones), 0.35);
  });
});

describe('computeVariantPricing — stone discount rules', () => {
  const product = { ...baseProduct, stones: rubyAndCz };

  test('a rule scoped to Ruby discounts only the ruby line, not the CZ line', async () => {
    const ruleSet = ruleSetWith({ stoneGlobal: [stoneRule({ stoneTypeIds: [RUBY], discountValue: 25 })] });
    const result = await computeVariantPricing(product, null, null, null, ruleSet);
    const [ruby, cz] = result.stoneComponents;
    assert.equal(ruby.discountAmount, 600);
    assert.equal(ruby.finalValue, 1800);
    assert.equal(ruby.source, 'GLOBAL_RULE');
    assert.equal(cz.discountAmount, 0);
    assert.equal(cz.finalValue, 360);
    assert.equal(result.stoneValue, 2160);
    assert.equal(result.stoneValueOriginal, 2760);
  });

  test('a rule with no stone types selected applies to every stone line', async () => {
    const ruleSet = ruleSetWith({ stoneGlobal: [stoneRule({ discountValue: 10 })] });
    const result = await computeVariantPricing(product, null, null, null, ruleSet);
    assert.deepEqual(
      result.stoneComponents.map((c) => c.discountAmount),
      [240, 36],
    );
    assert.equal(result.stoneValue, 2484);
  });

  test('a carat-range condition only matches lines inside the range', async () => {
    const ruleSet = ruleSetWith({
      stoneGlobal: [
        stoneRule({
          discountValue: 50,
          conditions: [{ condition_type: 'CARAT_RANGE', min_value: '0.25', max_value: null, string_values: null }],
        }),
      ],
    });
    const result = await computeVariantPricing(product, null, null, null, ruleSet);
    const [ruby, cz] = result.stoneComponents;
    assert.equal(ruby.discountAmount, 1200, '0.30 ct ruby is inside >= 0.25 ct');
    assert.equal(cz.discountAmount, 0, '0.24 ct CZ is outside');
  });

  test('a fixed per-carat rule discounts carats x amount, clamped to the line value', async () => {
    const ruleSet = ruleSetWith({
      stoneGlobal: [stoneRule({ discountType: 'FIXED_AMOUNT_PER_CARAT', discountValue: 2000 })],
    });
    const result = await computeVariantPricing(product, null, null, null, ruleSet);
    const [ruby, cz] = result.stoneComponents;
    assert.equal(ruby.discountAmount, 600); // 0.30 ct x 2000
    assert.equal(cz.discountAmount, 360); // 0.24 x 2000 = 480, clamped to the ₹360 line
    assert.equal(cz.clamped, true);
  });

  test('with no live rule, the flat product discount still applies through the ruleSet path', async () => {
    const result = await computeVariantPricing({ ...product, stone_discount_percent: 10 }, null, null, null, ruleSetWith());
    assert.equal(result.stoneValue, 2484);
  });
});

describe('computeVariantPricing — weight resolution hierarchy (Purity / Purity+Size rules)', () => {
  const purityRule = { purity_value_id: 'v-purity', size_value_id: null, gold_weight_grams: '5.000' };
  const puritySizeRule = { purity_value_id: 'v-purity', size_value_id: 'v-size', gold_weight_grams: '7.500' };

  function makeVariantWithSize({ sizeValueId, goldWeightGrams }) {
    const v = makeVariant({ purity: '9K', goldWeightGrams });
    if (sizeValueId) v.attributes.size = { valueId: sizeValueId, value: '6', label: '6', refId: null };
    return v;
  }

  test('no matching rule at all -> falls through to base product weight', async () => {
    const rate = await rate9k();
    const result = await computeVariantPricing(baseProduct, makeVariant({ purity: '9K' }), []);
    assert.equal(result.goldValue, goldAt(10, rate));
  });

  test('a Purity-only rule applies when the variant has no exact weight of its own', async () => {
    const rate = await rate9k();
    const result = await computeVariantPricing(baseProduct, makeVariant({ purity: '9K' }), [purityRule]);
    assert.equal(result.goldValue, goldAt(5, rate));
  });

  test('a Purity+Size rule beats a Purity-only rule when both match', async () => {
    const rate = await rate9k();
    const result = await computeVariantPricing(baseProduct, makeVariantWithSize({ sizeValueId: 'v-size' }), [purityRule, puritySizeRule]);
    assert.equal(result.goldValue, goldAt(7.5, rate));
  });

  test('a Purity-only rule still applies for a size not covered by any Purity+Size rule', async () => {
    const rate = await rate9k();
    const result = await computeVariantPricing(baseProduct, makeVariantWithSize({ sizeValueId: 'v-other-size' }), [purityRule, puritySizeRule]);
    assert.equal(result.goldValue, goldAt(5, rate));
  });

  test('a matching Purity+Size rule wins over the variant\'s own weight override', async () => {
    const rate = await rate9k();
    const variant = makeVariantWithSize({ sizeValueId: 'v-size', goldWeightGrams: 3 });
    const result = await computeVariantPricing(baseProduct, variant, [purityRule, puritySizeRule]);
    assert.equal(result.goldValue, goldAt(7.5, rate));
  });

  test('the variant\'s own weight is used when no rule matches it at all', async () => {
    const rate = await rate9k();
    const variant = makeVariantWithSize({ sizeValueId: 'v-unruled-size', goldWeightGrams: 3 });
    const result = await computeVariantPricing(baseProduct, variant, []);
    assert.equal(result.goldValue, goldAt(3, rate));
  });

  test('a variant with no purity at all never consults weight rules', async () => {
    const rate = await rate9k();
    const result = await computeVariantPricing(baseProduct, makeVariant({ goldColor: 'ROSE' }), [purityRule]);
    assert.equal(result.goldValue, goldAt(10, rate));
  });
});

describe('computeVariantPricing — per-variant price override', () => {
  test('a variant with a price override short-circuits to it, not the live computation', async () => {
    const result = await computeVariantPricing({ ...baseProduct, stones: rubyAndCz }, makeVariant({ purity: '9K', priceOverride: 55000 }));
    assert.equal(result.sellingPrice, 55000);
    assert.equal(result.sellingPriceOriginal, 55000);
    assert.equal(result.isPriceOverridden, true);
    // Component breakdown is still the live computation (informational only).
    assert.equal(result.stoneValue, 2760);
    assert.notEqual(result.goldValue, 55000);
  });

  test('a variant with no override -> isPriceOverridden is false', async () => {
    const result = await computeVariantPricing(baseProduct, makeVariant({ purity: '9K' }));
    assert.equal(result.isPriceOverridden, false);
  });

  test('a product-level promotional offer does not layer on top of a manual override', async () => {
    const product = { ...baseProduct, stones: rubyAndCz, making_charge_discount_percent: 50, stone_discount_percent: 50 };
    const result = await computeVariantPricing(product, makeVariant({ priceOverride: 42000 }));
    assert.equal(result.sellingPrice, 42000);
    assert.equal(result.makingChargeDiscountPercent, 0);
    assert.equal(result.stoneDiscountPercent, 0);
  });
});

// The exact weight-precedence scenarios from the implementation spec,
// phrased with the spec's own example numbers.
describe('Required weight-precedence scenarios (Tests A-D)', () => {
  const product = { ...baseProduct, gold_weight_grams: '0.500', gold_value: 0, making_charge: 100 };

  function sized(goldWeightGrams) {
    const variant = makeVariant({ purity: '9K', goldWeightGrams });
    variant.attributes.size = { valueId: 'v-size', value: '6', label: '6', refId: null };
    return variant;
  }

  test('Test A - exact rule wins: 9K+Size6 rule 0.256g overrides variant weight 0.586g', async () => {
    const rules = [{ purity_value_id: 'v-purity', size_value_id: 'v-size', gold_weight_grams: '0.256' }];
    const result = await computeVariantPricing(product, sized(0.586), rules);
    assert.equal(result.goldWeightGrams, 0.256);
  });

  test('Test B - purity default fallback: 9K default 0.300g overrides variant weight 0.586g', async () => {
    const rules = [{ purity_value_id: 'v-purity', size_value_id: null, gold_weight_grams: '0.300' }];
    const result = await computeVariantPricing(product, sized(0.586), rules);
    assert.equal(result.goldWeightGrams, 0.3);
  });

  test('Test C - variant fallback: no rule -> variant weight 0.586g used', async () => {
    const result = await computeVariantPricing(product, sized(0.586), []);
    assert.equal(result.goldWeightGrams, 0.586);
  });

  test('Test D - product fallback: no rule and no variant weight -> product base weight 0.500g used', async () => {
    const result = await computeVariantPricing(product, sized(undefined), []);
    assert.equal(result.goldWeightGrams, 0.5);
  });
});

describe('Required calculation scenario', () => {
  test('9K @ Rs.5056.97/g, 0.256g, stones Rs.3000, 60% making charge, 3% GST -> Rs.5223.47', () => {
    const goldValue = Math.round(5056.97 * 0.256 * 100) / 100;
    const stoneValue = computeStoneValue([{ price: 3000 }]);
    const makingCharge = Math.round(goldValue * 0.6 * 100) / 100;

    assert.equal(goldValue, 1294.58);
    assert.equal(stoneValue, 3000);
    assert.equal(makingCharge, 776.75);
    assert.equal(computeSellingPrice({ goldValue, stoneValue, makingCharge, gstPercent: 3 }), 5223.47);
  });
});

// Purity Pricing Rules (product_purity_pricing_rules) — Product+Purity
// overrides for making_charge_percent / making_charge_discount_percent /
// stone_discount_percent. 9Karet only has the one 9K purity, so these act as
// the product's per-size-independent charge/discount overrides.
describe('Purity Pricing Rules — making charge/discount resolution', () => {
  const product = {
    ...baseProduct,
    gold_weight_grams: '1.000',
    gold_value: 0,
    making_charge: 500,
    making_charge_percent: 40,
    making_charge_discount_percent: 10,
    stone_discount_percent: 10,
    stones: rubyAndCz,
  };

  function variantFor(purityValueId, sizeValueId) {
    const attributes = { purity: { valueId: purityValueId, value: '9K', label: '9K', refId: null } };
    if (sizeValueId) attributes.size = { valueId: sizeValueId, value: sizeValueId, label: sizeValueId, refId: null };
    return { gold_weight_grams: null, price_override: null, combination_key: 'x', attributes };
  }

  const rule = (fields) => ({ purity_value_id: 'purity-9k', ...fields });

  test('purity rule (60/10/5) wins over product defaults (40/10/10)', async () => {
    const rules = [rule({ making_charge_percent: '60', making_charge_discount_percent: '10', stone_discount_percent: '5' })];
    const result = await computeVariantPricing(product, variantFor('purity-9k'), [], rules);
    assert.equal(result.goldValue > 0, true);
    assert.equal(result.makingChargeOriginal, Math.round(result.goldValue * 0.6 * 100) / 100);
    assert.equal(result.makingChargeDiscountPercent, 10);
    assert.equal(result.stoneDiscountPercent, 5);
  });

  test('field-level fallback: rule overrides making charge only, discounts fall back independently', async () => {
    const rules = [rule({ making_charge_percent: '60', making_charge_discount_percent: null, stone_discount_percent: '0' })];
    const result = await computeVariantPricing(product, variantFor('purity-9k'), [], rules);
    assert.equal(result.makingChargeOriginal, Math.round(result.goldValue * 0.6 * 100) / 100, 'making charge: rule override (60%)');
    assert.equal(result.makingChargeDiscountPercent, 10, 'making discount: inherited from product default (10%)');
    assert.equal(result.stoneDiscountPercent, 0, 'stone discount: explicit rule 0%, not product default 10%');
  });

  test('no rule row for the variant\'s purity -> all three fields fall back to product-level defaults', async () => {
    const result = await computeVariantPricing(product, variantFor('purity-other'), [], [rule({ making_charge_percent: '60' })]);
    assert.equal(result.makingChargeOriginal, Math.round(result.goldValue * 0.4 * 100) / 100);
    assert.equal(result.makingChargeDiscountPercent, 10);
    assert.equal(result.stoneDiscountPercent, 10);
  });

  test('the same rule applies identically across sizes (charges never vary by size)', async () => {
    const rules = [rule({ making_charge_percent: '60', making_charge_discount_percent: '10', stone_discount_percent: '5' })];
    const weightRules = [
      { purity_value_id: 'purity-9k', size_value_id: 'size-6', gold_weight_grams: '0.256' },
      { purity_value_id: 'purity-9k', size_value_id: 'size-8', gold_weight_grams: '0.400' },
    ];
    const size6 = await computeVariantPricing(product, variantFor('purity-9k', 'size-6'), weightRules, rules);
    const size8 = await computeVariantPricing(product, variantFor('purity-9k', 'size-8'), weightRules, rules);

    assert.notEqual(size6.goldWeightGrams, size8.goldWeightGrams, 'sanity check: weight does differ by size');
    assert.equal(size6.makingChargeDiscountPercent, size8.makingChargeDiscountPercent);
    assert.equal(size6.stoneDiscountPercent, size8.stoneDiscountPercent);
    assert.equal(size6.makingChargeOriginal, Math.round(size6.goldValue * 0.6 * 100) / 100);
    assert.equal(size8.makingChargeOriginal, Math.round(size8.goldValue * 0.6 * 100) / 100);
  });

  test('a variant price_override still bypasses purity-pricing rules entirely', async () => {
    const rules = [rule({ making_charge_percent: '60', making_charge_discount_percent: '10', stone_discount_percent: '5' })];
    const result = await computeVariantPricing(product, { ...variantFor('purity-9k'), price_override: 12345 }, [], rules);
    assert.equal(result.isPriceOverridden, true);
    assert.equal(result.sellingPrice, 12345);
    assert.equal(result.makingChargeDiscountPercent, 0);
    assert.equal(result.stoneDiscountPercent, 0);
  });
});
