// audit_logs — every admin mutation. See plan §3/§39.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id UUID,
      diff JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX audit_logs_entity_idx ON audit_logs(entity, entity_id);');
  pgm.sql('CREATE INDEX audit_logs_admin_user_id_idx ON audit_logs(admin_user_id);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS audit_logs;');
};
