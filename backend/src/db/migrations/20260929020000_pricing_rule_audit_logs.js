// Pricing Rule Management, Phase 1: a rich, permanent audit trail — separate
// from the generic audit_logs table, whose `diff` is just the raw request
// body and `action` is the HTTP verb, which can't express ACTIVATED/EXPIRED,
// before/after values, or an affected-product count. rule_id is ON DELETE
// SET NULL, never CASCADE, specifically so these rows outlive the rule they
// describe — "never deleted, even when a rule is removed" is a hard
// requirement, not a convenience.
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE pricing_rule_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id UUID REFERENCES pricing_rules(id) ON DELETE SET NULL,
      rule_name_snapshot TEXT NOT NULL,
      rule_type TEXT,
      action TEXT NOT NULL CHECK (action IN (
        'CREATED','UPDATED','ACTIVATED','DEACTIVATED','SCHEDULED','EXPIRED','DELETED',
        'REPRICE_STARTED','REPRICE_COMPLETED','REPRICE_FAILED',
        'OVERRIDE_REMOVED','OVERRIDE_RESTORED','BULK_OVERRIDE_ACTION'
      )),
      previous_value JSONB,
      new_value JSONB,
      affected_product_count INTEGER,
      product_id UUID REFERENCES products(id) ON DELETE SET NULL,
      admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      admin_email_snapshot TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql(`CREATE INDEX pricing_rule_audit_logs_rule_idx ON pricing_rule_audit_logs(rule_id, created_at DESC);`);
  pgm.sql(`CREATE INDEX pricing_rule_audit_logs_created_idx ON pricing_rule_audit_logs(created_at DESC);`);
  pgm.sql(`CREATE INDEX pricing_rule_audit_logs_product_idx ON pricing_rule_audit_logs(product_id) WHERE product_id IS NOT NULL;`);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS pricing_rule_audit_logs;');
};
