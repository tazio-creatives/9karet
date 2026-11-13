// Real provider — generic SMTP (e.g. Gmail with an App Password). Unlike a
// brand-new SES account, there's no sandbox/per-recipient-verification step
// to wait on — the tradeoff is whatever the mailbox's own daily sending
// limit is (Gmail: ~500/day with an App Password), and no built-in bounce/
// complaint feed the way SES+SNS has.
import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

let transporter = null;
function getTransporter() {
  if (!transporter) {
    if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
      throw new Error('SMTP_HOST/SMTP_USER/SMTP_PASS must be set — required when EMAIL_PROVIDER=smtp');
    }
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure, // true for port 465, false for 587/STARTTLS
      auth: { user: env.smtpUser, pass: env.smtpPass },
    });
  }
  return transporter;
}

export const smtpEmailProvider = {
  name: 'smtp',

  // `html` is optional — when a template provides one (the order-status
  // emails), nodemailer sends a proper multipart message; templates with
  // no html (unchanged) send exactly as before, plain text only.
  async send({ to, subject, body, html }) {
    if (!env.smtpFromEmail) {
      throw new Error('SMTP_FROM_EMAIL (or SMTP_USER) is not set — required when EMAIL_PROVIDER=smtp');
    }

    await getTransporter().sendMail({
      from: `${env.smtpFromName} <${env.smtpFromEmail}>`,
      to,
      subject,
      text: body,
      ...(html ? { html } : {}),
    });
  },
};
