import { boss } from '../jobs/queue.js';
import { JOB_EMAIL_SEND } from '../jobs/emailJob.js';
import { insertEmailJob } from '../repositories/emailJobs.repository.js';

// Called after the triggering DB transaction has committed (same pattern as
// invalidateProductsPagesBatch in paymentService.js) — the email_jobs row is
// the durable record of intent-to-send, boss.send() just wakes the worker.
export async function enqueueEmail(toEmail, template, payload = {}) {
  if (!toEmail) return null;
  const job = await insertEmailJob({ toEmail, template, payload });
  await boss.send(JOB_EMAIL_SEND, { emailJobId: job.id });
  return job;
}
