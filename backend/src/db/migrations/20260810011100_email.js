// email_jobs (queue) / email_logs (delivery record). See plan §12/§37.

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE email_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      to_email TEXT NOT NULL,
      template TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX email_jobs_status_idx ON email_jobs(status);');

  pgm.sql(`
    CREATE TABLE email_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email_job_id UUID REFERENCES email_jobs(id) ON DELETE SET NULL,
      to_email TEXT NOT NULL,
      template TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  pgm.sql('CREATE INDEX email_logs_email_job_id_idx ON email_logs(email_job_id);');
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS email_logs;');
  pgm.sql('DROP TABLE IF EXISTS email_jobs;');
};
