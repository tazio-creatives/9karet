import { isProduction } from '../../config/env.js';

// Dev/test provider — logs instead of sending a real email (plan §12).
// Swappable for a real provider via EMAIL_PROVIDER (see emailProvider.ses.js),
// same pattern as OTP/payment/shipping/AI-image providers.
export const stubEmailProvider = {
  async send({ to, subject, body, html }) {
    if (isProduction) {
      throw new Error('emailProvider.stub must not be used in production');
    }
    console.log(`[stub email] -> ${to} | ${subject}${html ? ' (+html)' : ''}\n${body}\n`);
  },
};
