// Real provider — AWS SES. Templates are plain text (emailTemplates.js:
// "minimal stack, no templating engine"), so this sends Body.Text only, no
// Body.Html.
//
// SES starts every new account in sandbox mode: it can only send to
// verified addresses/domains and is capped at 200 emails/day until AWS
// approves a production-access request (can take a day or two to review) —
// request that early if going live with this provider, not after hitting
// the cap.
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { env } from '../../config/env.js';

let client = null;
function getClient() {
  if (!client) {
    client = new SESClient({
      region: env.sesRegion,
      ...(env.s3AccessKeyId && env.s3SecretAccessKey
        ? { credentials: { accessKeyId: env.s3AccessKeyId, secretAccessKey: env.s3SecretAccessKey } }
        : {}),
    });
  }
  return client;
}

export const sesEmailProvider = {
  name: 'ses',

  // `html` is optional — when a template provides one (the order-status
  // emails), it's sent alongside the plain-text `body` as a proper
  // multipart message; templates with no html (unchanged) send exactly as
  // before, Text-only.
  async send({ to, subject, body, html }) {
    if (!env.sesFromEmail) {
      throw new Error('SES_FROM_EMAIL is not set — required when EMAIL_PROVIDER=ses');
    }

    await getClient().send(
      new SendEmailCommand({
        Source: `${env.sesFromName} <${env.sesFromEmail}>`,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: body, Charset: 'UTF-8' },
            ...(html ? { Html: { Data: html, Charset: 'UTF-8' } } : {}),
          },
        },
      }),
    );
  },
};
