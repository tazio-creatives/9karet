import {
  findLiveRules,
  findRuleCategoryLinks,
  findRuleProductLinks,
  findRuleStoneTypeLinks,
  findRulePurityLinks,
  findRuleConditions,
} from '../repositories/pricingRules.repository.js';

// Local round2 (duplicated from pricingService.js's identical one-liner)
// rather than imported, to avoid a circular import: pricingService.js
// imports resolve*/loadActiveRuleSet from this module.
function round2(n) {
  return Math.round(n * 100) / 100;
}

function numOrNull(v) {
  return v == null ? null : Number(v);
}

// A rule's real liveness is always DERIVED from status+starts_at+ends_at,
// never trusted from `status` alone — the Phase 2 status-sweep cron flips
// SCHEDULED->ACTIVE and ACTIVE->EXPIRED on a 5-minute tick, and resolution
// must never depend on that tick having already run. findLiveRules() already
// restricts to status IN ('ACTIVE','SCHEDULED'); this is what actually
// decides whether a SCHEDULED rule's window has started or an ACTIVE rule's
// window has already lapsed.
export function isLive(rule, at) {
  if (rule.status === 'DRAFT' || rule.status === 'DISABLED' || rule.status === 'EXPIRED') return false;
  if (rule.starts_at && new Date(rule.starts_at) > at) return false;
  if (rule.ends_at && new Date(rule.ends_at) <= at) return false;
  return true;
}

const EMPTY_RULE_SET = {
  makingByProduct: new Map(),
  makingByCategory: new Map(),
  makingGlobal: [],
  stoneByProduct: new Map(),
  stoneByCategory: new Map(),
  stoneGlobal: [],
};

function bucketRule(rule, byProduct, byCategory, global, links) {
  const { productIds, categoryIds } = links;
  if (rule.scope === 'PRODUCT') {
    for (const productId of productIds) {
      if (!byProduct.has(productId)) byProduct.set(productId, []);
      byProduct.get(productId).push(rule);
    }
  } else if (rule.scope === 'CATEGORY') {
    for (const categoryId of categoryIds) {
      if (!byCategory.has(categoryId)) byCategory.set(categoryId, []);
      byCategory.get(categoryId).push(rule);
    }
  } else {
    global.push(rule);
  }
}

function buildRuleSet(liveRules, categoryLinks, productLinks, stoneTypeLinks, purityLinks, conditionRows) {
  const productIdsByRule = new Map();
  for (const { rule_id, product_id } of productLinks) {
    if (!productIdsByRule.has(rule_id)) productIdsByRule.set(rule_id, []);
    productIdsByRule.get(rule_id).push(product_id);
  }
  const categoryIdsByRule = new Map();
  for (const { rule_id, category_id } of categoryLinks) {
    if (!categoryIdsByRule.has(rule_id)) categoryIdsByRule.set(rule_id, []);
    categoryIdsByRule.get(rule_id).push(category_id);
  }
  const stoneTypeIdsByRule = new Map();
  for (const { rule_id, stone_type_id } of stoneTypeLinks) {
    if (!stoneTypeIdsByRule.has(rule_id)) stoneTypeIdsByRule.set(rule_id, new Set());
    stoneTypeIdsByRule.get(rule_id).add(stone_type_id);
  }
  const purityIdsByRule = new Map();
  for (const { rule_id, purity_value_id } of purityLinks) {
    if (!purityIdsByRule.has(rule_id)) purityIdsByRule.set(rule_id, new Set());
    purityIdsByRule.get(rule_id).add(purity_value_id);
  }
  const conditionsByRule = new Map();
  for (const row of conditionRows) {
    if (!conditionsByRule.has(row.rule_id)) conditionsByRule.set(row.rule_id, []);
    conditionsByRule.get(row.rule_id).push(row);
  }

  const makingByProduct = new Map();
  const makingByCategory = new Map();
  const makingGlobal = [];
  const stoneByProduct = new Map();
  const stoneByCategory = new Map();
  const stoneGlobal = [];

  for (const rule of liveRules) {
    const enriched = {
      ...rule,
      priority: Number(rule.priority),
      discount_value: Number(rule.discount_value),
      purityValueIds: purityIdsByRule.get(rule.id) ?? new Set(),
      stoneTypeIds: stoneTypeIdsByRule.get(rule.id) ?? new Set(),
      conditions: conditionsByRule.get(rule.id) ?? [],
    };
    const links = {
      productIds: productIdsByRule.get(rule.id) ?? [],
      categoryIds: categoryIdsByRule.get(rule.id) ?? [],
    };
    if (rule.rule_type === 'MAKING_CHARGE') {
      bucketRule(enriched, makingByProduct, makingByCategory, makingGlobal, links);
    } else {
      bucketRule(enriched, stoneByProduct, stoneByCategory, stoneGlobal, links);
    }
  }

  return { makingByProduct, makingByCategory, makingGlobal, stoneByProduct, stoneByCategory, stoneGlobal };
}

let cachedRuleSet = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

// Called from every rule mutation (create/update/activate/disable/delete —
// Phase 2+) and at the start of every repricing job run, so a just-saved
// change is never resolved against a stale in-memory set. The 30s TTL below
// is the staleness bound for anything that DOESN'T explicitly invalidate
// (e.g. the status-sweep cron flipping a rule's status column) — same
// reasoning the codebase already applies to SSR_CACHE_TTL_SECONDS. Single
// API process today; a multi-process deploy would need this TTL to be the
// documented cross-process staleness bound instead.
export function invalidateRuleSetCache() {
  cachedRuleSet = null;
  cachedAt = 0;
}

// `at` defaults to "now" and is cached (30s TTL, see above). Passing an
// explicit `at` (e.g. a preview simulating a future/past moment) always
// computes fresh and is never cached, since a cached "now" answer would be
// wrong for a different `at`.
export async function loadActiveRuleSet({ at, forceRefresh = false } = {}) {
  const useNow = at == null;
  const effectiveAt = at ?? new Date();

  if (useNow && !forceRefresh && cachedRuleSet && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedRuleSet;
  }

  const rawRules = await findLiveRules();
  const liveRules = rawRules.filter((r) => isLive(r, effectiveAt));

  let ruleSet;
  if (liveRules.length === 0) {
    ruleSet = EMPTY_RULE_SET;
  } else {
    // Sequential, not Promise.all — applyBaseProductPricing (and therefore
    // this function) is sometimes called from inside an active
    // withTransaction block (product create/update), which pins query() to
    // one shared client for the duration; truly concurrent queries on one
    // pg client are deprecated (and only accidentally safe today because
    // node-pg silently queues them). Five small indexed lookups in sequence
    // costs a few ms and is correct under every calling context.
    const ruleIds = liveRules.map((r) => r.id);
    const categoryLinks = await findRuleCategoryLinks(ruleIds);
    const productLinks = await findRuleProductLinks(ruleIds);
    const stoneTypeLinks = await findRuleStoneTypeLinks(ruleIds);
    const purityLinks = await findRulePurityLinks(ruleIds);
    const conditionRows = await findRuleConditions(ruleIds);
    ruleSet = buildRuleSet(liveRules, categoryLinks, productLinks, stoneTypeLinks, purityLinks, conditionRows);
  }

  if (useNow) {
    cachedRuleSet = ruleSet;
    cachedAt = Date.now();
  }
  return ruleSet;
}

function pickBest(rules) {
  if (!rules.length) return null;
  return [...rules].sort(
    (a, b) => b.priority - a.priority || new Date(b.created_at) - new Date(a.created_at),
  )[0];
}

// Deepest-matching-category-wins: scans categoryAncestorIds (self, then
// parent, then grandparent, ... — see getCategoryAndAncestorIds) and returns
// every matching candidate at the FIRST level that has any, or null if no
// ancestor level has a match at all. Stopping at the first non-empty level
// (rather than merging matches across levels) is what makes "deepest
// matching category" well-defined when both a product's direct category and
// a grandparent category each have their own rule.
function pickCategoryLevel(byCategoryMap, categoryAncestorIds, matches) {
  for (const categoryId of categoryAncestorIds) {
    const candidates = (byCategoryMap.get(categoryId) ?? []).filter(matches);
    if (candidates.length) return candidates;
  }
  return null;
}

// Clamped per the approved "clamp, don't reject" decision: a discount that
// would exceed `base` (or go negative — FIXED_AMOUNT/FIXED_AMOUNT_PER_CARAT
// only, PERCENT can't) is capped to base/0. `clamped` is surfaced so the
// Rule Preview panel (Phase 3) can show a "N products will be clamped to
// zero" warning instead of staying silent about it.
function amountFor(rule, base, carats) {
  let raw;
  if (rule.discount_type === 'PERCENT') raw = base * (rule.discount_value / 100);
  else if (rule.discount_type === 'FIXED_AMOUNT') raw = rule.discount_value;
  else raw = rule.discount_value * (carats ?? 0); // FIXED_AMOUNT_PER_CARAT

  const clamped = raw > base || raw < 0;
  const amount = round2(Math.min(Math.max(raw, 0), base));
  return {
    amount,
    percent: base > 0 ? round2((amount / base) * 100) : 0,
    ruleId: rule.id,
    ruleName: rule.name,
    source: `${rule.scope}_RULE`,
    clamped,
  };
}

function purityTierResult(base, percent) {
  return { amount: round2(base * (percent / 100)), percent, ruleId: null, ruleName: null, source: 'PURITY_RULE', clamped: false };
}

function flatTierResult(base, percent) {
  return { amount: round2(base * (percent / 100)), percent, ruleId: null, ruleName: null, source: 'PRODUCT_FLAT', clamped: false };
}

const ZERO_RESULT = { amount: 0, percent: 0, ruleId: null, ruleName: null, source: 'NONE', clamped: false };

// The shared resolution engine for both making-charge and stone discount —
// implements the user-approved, corrected tier order:
//   1. PRODUCT-scope pricing_rules row
//   2. product_purity_pricing_rules override (tier2Value)
//   3. flat products.*_discount_percent column (tier3Value)
//   4. deepest-matching CATEGORY-scope rule
//   5. GLOBAL-scope rule
//   6. zero
// "Preserve" (default) is structural: tiers 2/3 are checked before 4/5
// whenever they're present. The ONLY way a tier-4/5 rule reaches a product
// that already has a tier-2/3 value is if the rule that would otherwise win
// tier 4/5 has override_mode = 'SUPPRESS' — in which case tiers 2/3 are
// skipped for this resolution. Suppression is re-evaluated on every call
// (nothing is written anywhere), so the moment that rule stops being live —
// expires, is disabled, or is deleted — the very next resolution reverts to
// tiers 2/3 automatically, with zero data to restore.
function resolveTier({ productRules, tier2Value, tier3Value, categoryCandidates, globalCandidates, base, carats }) {
  const productPick = pickBest(productRules);
  if (productPick) return amountFor(productPick, base, carats); // tier 1

  const categoryPick = categoryCandidates?.length ? pickBest(categoryCandidates) : null;
  const globalPick = globalCandidates.length ? pickBest(globalCandidates) : null;
  const catOrGlobalPick = categoryPick ?? globalPick; // tier 4 beats tier 5

  const hasProductOverride = tier2Value != null || tier3Value > 0;
  const suppressed = catOrGlobalPick != null && catOrGlobalPick.override_mode === 'SUPPRESS';

  if (hasProductOverride && !suppressed) {
    if (tier2Value != null) return purityTierResult(base, tier2Value); // tier 2
    return flatTierResult(base, tier3Value); // tier 3
  }

  if (catOrGlobalPick) return amountFor(catOrGlobalPick, base, carats); // tier 4 or 5

  if (tier2Value != null) return purityTierResult(base, tier2Value);
  if (tier3Value > 0) return flatTierResult(base, tier3Value);
  return ZERO_RESULT; // tier 6
}

// purityValueId/purityRuleRow are exactly what pricingService.js's
// resolveWeightFromRules/resolvePurityPricingRuleRow already resolve —
// callers pass those straight through, no new resolution logic duplicated.
export function resolveMakingChargeDiscount({ product, categoryAncestorIds, purityValueId, purityRuleRow, ruleSet, makingCharge }) {
  const matches = (r) => r.purity_scope === 'ALL' || (purityValueId != null && r.purityValueIds.has(purityValueId));
  const productRules = (ruleSet.makingByProduct.get(product.id) ?? []).filter(matches);
  const categoryCandidates = pickCategoryLevel(ruleSet.makingByCategory, categoryAncestorIds, matches);
  const globalCandidates = ruleSet.makingGlobal.filter(matches);
  return resolveTier({
    productRules,
    tier2Value: numOrNull(purityRuleRow?.making_charge_discount_percent),
    tier3Value: Number(product.making_charge_discount_percent ?? 0),
    categoryCandidates,
    globalCandidates,
    base: makingCharge,
    carats: null,
  });
}

// component: { stoneId, stoneTypeId, stoneTypeName, count, carats, value }
// — a gate at every tier: a rule whose scope doesn't match this stone line
// is simply not a candidate anywhere, never "blocks" a lower-priority rule
// that does match. A rule with no stone types selected applies to every
// stone type; otherwise the line's type must be one of them.
export function stoneMatches(rule, component) {
  if (rule.stoneTypeIds.size > 0 && !rule.stoneTypeIds.has(component.stoneTypeId)) return false;
  return conditionsMatch(rule.conditions, component);
}

function conditionsMatch(conditions, c) {
  for (const cond of conditions) {
    if (cond.condition_type === 'CARAT_RANGE') {
      if (cond.min_value != null && (c.carats ?? 0) < Number(cond.min_value)) return false;
      if (cond.max_value != null && (c.carats ?? 0) > Number(cond.max_value)) return false;
    }
  }
  return true;
}

// --- Rule Preview support (Phase 3) ---
//
// Builds an in-memory rule object shaped exactly like the ones
// loadActiveRuleSet produces, from a not-yet-saved admin form payload
// (already camelCase-validated by pricingRules.validators.js). Never
// persisted — id is a sentinel so the preview endpoint can tell "this
// product's discount came from the rule being previewed" apart from "it
// came from a real, already-saved rule".
export const PREVIEW_RULE_ID = '__preview__';

export function buildSyntheticRule(input) {
  return {
    id: PREVIEW_RULE_ID,
    name: input.name || '(unsaved rule)',
    rule_type: input.ruleType,
    scope: input.scope,
    discount_type: input.discountType,
    discount_value: Number(input.discountValue),
    purity_scope: input.purityScope ?? 'ALL',
    override_mode: input.overrideMode ?? 'PRESERVE',
    priority: Number(input.priority ?? 0),
    created_at: new Date().toISOString(),
    purityValueIds: new Set(input.purityValueIds ?? []),
    stoneTypeIds: new Set(input.stoneTypeIds ?? []),
    conditions: (input.conditions ?? []).map((c) => ({
      condition_type: c.conditionType,
      string_values: c.stringValues ?? null,
      min_value: c.minValue ?? null,
      max_value: c.maxValue ?? null,
    })),
  };
}

// Returns a shallow-cloned rule set with the synthetic rule added into the
// correct bucket for its scope — cloning (not mutating) `baseRuleSet` is
// what lets the preview simulate "what if this rule existed" against the
// REAL current live rule set (so it correctly competes with other real
// Category/Global rules by priority) without ever touching the actual
// in-process cache loadActiveRuleSet maintains.
export function injectSyntheticRule(baseRuleSet, syntheticRule, { categoryIds = [], productIds = [] } = {}) {
  const clone = {
    makingByProduct: new Map(baseRuleSet.makingByProduct),
    makingByCategory: new Map(baseRuleSet.makingByCategory),
    makingGlobal: [...baseRuleSet.makingGlobal],
    stoneByProduct: new Map(baseRuleSet.stoneByProduct),
    stoneByCategory: new Map(baseRuleSet.stoneByCategory),
    stoneGlobal: [...baseRuleSet.stoneGlobal],
  };
  const isMaking = syntheticRule.rule_type === 'MAKING_CHARGE';
  const byProduct = isMaking ? clone.makingByProduct : clone.stoneByProduct;
  const byCategory = isMaking ? clone.makingByCategory : clone.stoneByCategory;

  if (syntheticRule.scope === 'PRODUCT') {
    for (const id of productIds) byProduct.set(id, [...(byProduct.get(id) ?? []), syntheticRule]);
  } else if (syntheticRule.scope === 'CATEGORY') {
    for (const id of categoryIds) byCategory.set(id, [...(byCategory.get(id) ?? []), syntheticRule]);
  } else if (isMaking) {
    clone.makingGlobal.push(syntheticRule);
  } else {
    clone.stoneGlobal.push(syntheticRule);
  }
  return clone;
}

export function resolveStoneDiscount({ product, categoryAncestorIds, purityRuleRow, ruleSet, component }) {
  const matches = (r) => stoneMatches(r, component);
  const productRules = (ruleSet.stoneByProduct.get(product.id) ?? []).filter(matches);
  const categoryCandidates = pickCategoryLevel(ruleSet.stoneByCategory, categoryAncestorIds, matches);
  const globalCandidates = ruleSet.stoneGlobal.filter(matches);
  return resolveTier({
    productRules,
    tier2Value: numOrNull(purityRuleRow?.stone_discount_percent),
    tier3Value: Number(product.stone_discount_percent ?? 0),
    categoryCandidates,
    globalCandidates,
    base: component.value,
    carats: component.carats,
  });
}
