import { boss, createQueueSafe } from './queue.js';
import { env } from '../config/env.js';
import { emailProvider } from '../providers/email/index.js';
import { renderEmailTemplate } from '../services/emailTemplates.js';
import {
  findEmailJobById,
  markEmailJobStatus,
  insertEmailLog,
} from '../repositories/emailJobs.repository.js';

export const JOB_EMAIL_SEND = 'email-send';

// plan §12: every transactional event enqueues an email_jobs row instead of
// sending inline; this worker is the only thing that ever calls the
// provider. Failures retry with backoff (queue-level retryLimit/retryDelay/
// retryBackoff below) and never delay the HTTP response that triggered them.
//
// pg-boss v10's work() callback receives an array of jobs, not a single job
// (see aiImageJob.js) — batchSize defaults to 1 here too.
async function emailSendHandler(jobs) {
  const [job] = jobs;
  const { emailJobId } = job.data;

  const emailJob = await findEmailJobById(emailJobId);
  if (!emailJob) return;

  try {
    const { subject, body, html } = await renderEmailTemplate(emailJob.template, emailJob.payload);
    await emailProvider.send({ to: emailJob.to_email, subject, body, html });
    await markEmailJobStatus(emailJobId, 'SENT');
    await insertEmailLog({
      emailJobId,
      toEmail: emailJob.to_email,
      template: emailJob.template,
      status: 'SENT',
    });
  } catch (err) {
    await markEmailJobStatus(emailJobId, 'FAILED');
    await insertEmailLog({
      emailJobId,
      toEmail: emailJob.to_email,
      template: emailJob.template,
      status: 'FAILED',
      error: err.message,
    });
    throw err; // rethrow so pg-boss retries per the queue's retry policy
  }
}

export async function registerEmailWorker() {
  await createQueueSafe(JOB_EMAIL_SEND, {
    retryLimit: env.emailJobRetryLimit,
    retryDelay: env.emailJobRetryDelaySeconds,
    retryBackoff: true,
  });
  await boss.work(JOB_EMAIL_SEND, emailSendHandler);
}
