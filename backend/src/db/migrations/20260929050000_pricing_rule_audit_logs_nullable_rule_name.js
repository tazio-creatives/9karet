// Pricing Rule Management, Phase 5: pricing_rule_audit_logs.rule_name_snapshot
// was NOT NULL from its original migration, which only anticipated
// rule-centric actions (CREATED/UPDATED/ACTIVATED/...). Phase 5 added two
// genuinely rule-less, PRODUCT-centric actions — BULK_OVERRIDE_ACTION and
// OVERRIDE_RESTORED, fired from the Product Overrides page and never tied
// to any one pricing_rules row — which have no rule name to snapshot at
// all. Loosening this to nullable (rather than inventing a placeholder
// string like "(product override)") keeps the column meaning exactly what
// its name says: the rule's name, when there was one.
export const up = (pgm) => {
  pgm.sql(`ALTER TABLE pricing_rule_audit_logs ALTER COLUMN rule_name_snapshot DROP NOT NULL;`);
};

export const down = (pgm) => {
  // Backfill any NULLs before re-adding NOT NULL, so a rollback doesn't
  // fail outright if Phase 5 audit rows already exist.
  pgm.sql(`UPDATE pricing_rule_audit_logs SET rule_name_snapshot = '(product override)' WHERE rule_name_snapshot IS NULL;`);
  pgm.sql(`ALTER TABLE pricing_rule_audit_logs ALTER COLUMN rule_name_snapshot SET NOT NULL;`);
};
