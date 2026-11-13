// Pricing Rule Management, Phase 2: background repricing job tracking.
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE pricing_reprice_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id UUID REFERENCES pricing_rules(id) ON DELETE SET NULL,
      rule_name_snapshot TEXT,
      trigger TEXT NOT NULL CHECK (trigger IN (
        'RULE_CREATED','RULE_UPDATED','RULE_ACTIVATED','RULE_DISABLED',
        'RULE_EXPIRED','RULE_DELETED','OVERRIDE_BULK','MANUAL'
      )),
      status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN (
        'QUEUED','RUNNING','COMPLETED','COMPLETED_WITH_ERRORS','FAILED','CANCELLED'
      )),
      product_ids UUID[] NOT NULL DEFAULT '{}',
      total_count INTEGER NOT NULL DEFAULT 0,
      processed_count INTEGER NOT NULL DEFAULT 0,
      changed_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      failures JSONB NOT NULL DEFAULT '[]',
      error TEXT,
      requested_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // One in-flight job per rule (or one rule-less/MANUAL job) at a time —
  // the authoritative duplicate-prevention mechanism; the queue-layer
  // singletonKey and the handler's atomic claim (pricingRuleJobs.js) are
  // belt-and-braces on top of this.
  pgm.sql(`
    CREATE UNIQUE INDEX pricing_reprice_jobs_one_active
      ON pricing_reprice_jobs (COALESCE(rule_id, '00000000-0000-0000-0000-000000000000'::uuid))
      WHERE status IN ('QUEUED', 'RUNNING');
  `);
  pgm.sql(`CREATE INDEX pricing_reprice_jobs_recent_idx ON pricing_reprice_jobs(created_at DESC);`);
  pgm.sql(`CREATE INDEX pricing_reprice_jobs_rule_idx ON pricing_reprice_jobs(rule_id) WHERE rule_id IS NOT NULL;`);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS pricing_reprice_jobs;');
};
