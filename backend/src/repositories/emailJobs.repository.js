import { query } from '../config/db.js';

export async function insertEmailJob({ toEmail, template, payload }) {
  const { rows: [row] } = await query(
    `INSERT INTO email_jobs (to_email, template, payload) VALUES ($1, $2, $3) RETURNING *`,
    [toEmail, template, payload ?? {}],
  );
  return row;
}

export async function findEmailJobById(id) {
  const { rows } = await query('SELECT * FROM email_jobs WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function markEmailJobStatus(id, status) {
  await query('UPDATE email_jobs SET status = $2, attempts = attempts + 1 WHERE id = $1', [id, status]);
}

export async function insertEmailLog({ emailJobId, toEmail, template, status, error }) {
  await query(
    `INSERT INTO email_logs (email_job_id, to_email, template, status, error)
     VALUES ($1, $2, $3, $4, $5)`,
    [emailJobId, toEmail, template, status, error ?? null],
  );
}
