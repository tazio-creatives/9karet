// One-time repair: the product_variants backfill in migrateProductVariants.js
// wrote variant weights (sourced from the old product_sizes table) directly
// via raw SQL, bypassing applyBaseProductPricing — so the cached
// products.selling_price (what category listings and a product's initial
// PDP price show) was never resynced against the real per-variant weights.
// This just re-runs the same resync every admin edit already triggers
// (products.controller.js's adminUpdateVariant/adminBulkUpdateVariants),
// across the whole catalog. Idempotent and safe to re-run —
// applyBaseProductPricing no-ops when the cached price already matches.
//
// Usage: node backend/scripts/resyncListingPrices.js [--dry-run]

import { query, pool } from '../src/config/db.js';
import { applyBaseProductPricing } from '../src/services/productsService.js';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const { rows: products } = await query('SELECT id, name, slug, selling_price, is_price_locked FROM products');
  console.log(`Scanning ${products.length} products (dry-run: ${dryRun})...`);

  let changed = 0;
  for (const p of products) {
    const before = Number(p.selling_price);
    if (dryRun) {
      // Peek without writing: temporarily call the same computation path
      // isn't exposed read-only, so dry-run just reports which products
      // applyBaseProductPricing would touch by diffing before/after
      // inside a rolled-back transaction.
      await query('BEGIN');
      await applyBaseProductPricing(p.id, p.is_price_locked);
      const { rows } = await query('SELECT selling_price FROM products WHERE id = $1', [p.id]);
      const after = Number(rows[0].selling_price);
      await query('ROLLBACK');
      if (Math.abs(after - before) > 0.01) {
        changed++;
        console.log(`[would change] ${p.name} (${p.slug}): ${before} -> ${after}`);
      }
    } else {
      await applyBaseProductPricing(p.id, p.is_price_locked);
      const { rows } = await query('SELECT selling_price FROM products WHERE id = $1', [p.id]);
      const after = Number(rows[0].selling_price);
      if (Math.abs(after - before) > 0.01) {
        changed++;
        console.log(`[changed] ${p.name} (${p.slug}): ${before} -> ${after}`);
      }
    }
  }

  console.log(`Done. ${changed} product(s) ${dryRun ? 'would be' : 'were'} resynced.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
