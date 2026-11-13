// OroPocket gold-rate integration (replaces GoldAPI as primary source, kept
// as fallback). Two new tables:
//
// - gold_rate_settings: a singleton row holding the admin-configurable
//   Automatic/Manual source toggle + the optional rate-adjustment layer.
//   No settings table existed before this (see pricingService.js's own
//   comment noting that gap) — this is the first one, scoped to exactly
//   what §5/§7 of the spec need, not a general key-value store.
//
// - gold_rate_sync_runs: an audit/history log of every sync ATTEMPT
//   (success, failure, or rejected-for-deviation), including the OroPocket
//   vs GoldAPI side-by-side comparison (§13) and the failure reason (§10).
//   `gold_rates` itself (existing table) only ever gains rows on a successful
//   *applied* fetch, so it structurally cannot represent a failed attempt —
//   this is a genuinely new kind of record, not a duplicate of gold_rates.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE gold_rate_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
      source TEXT NOT NULL DEFAULT 'AUTOMATIC' CHECK (source IN ('AUTOMATIC', 'MANUAL')),
      adjustment_type TEXT NOT NULL DEFAULT 'NONE' CHECK (adjustment_type IN ('NONE', 'FIXED', 'PERCENTAGE')),
      adjustment_value NUMERIC(12, 4) NOT NULL DEFAULT 0,
      max_deviation_percent NUMERIC(6, 2) NOT NULL DEFAULT 10,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL
    );
  `);
  pgm.sql(`INSERT INTO gold_rate_settings (source, adjustment_type, adjustment_value) VALUES ('AUTOMATIC', 'NONE', 0);`);

  pgm.sql(`
    CREATE TABLE gold_rate_sync_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trigger TEXT NOT NULL CHECK (trigger IN ('CRON', 'MANUAL')),

      primary_provider TEXT NOT NULL,
      primary_status TEXT NOT NULL CHECK (primary_status IN ('SUCCESS', 'FAILED', 'SKIPPED')),
      primary_rate NUMERIC(12, 2),
      primary_error TEXT,

      fallback_provider TEXT,
      fallback_status TEXT CHECK (fallback_status IN ('SUCCESS', 'FAILED', 'SKIPPED')),
      fallback_rate NUMERIC(12, 2),
      fallback_error TEXT,

      resolved_provider TEXT,
      base_rate_24k NUMERIC(12, 2),
      adjustment_type TEXT NOT NULL DEFAULT 'NONE' CHECK (adjustment_type IN ('NONE', 'FIXED', 'PERCENTAGE')),
      adjustment_value NUMERIC(12, 4) NOT NULL DEFAULT 0,
      effective_rate_24k NUMERIC(12, 2),

      status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'REJECTED')),
      applied BOOLEAN NOT NULL DEFAULT false,
      rejected_reason TEXT,
      products_recalculated INTEGER,
      duration_ms INTEGER,

      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX gold_rate_sync_runs_created_idx ON gold_rate_sync_runs(created_at DESC);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS gold_rate_sync_runs;');
  pgm.sql('DROP TABLE IF EXISTS gold_rate_settings;');
};
