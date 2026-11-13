// Real provider — MSG91 OTP API v5. Credentials live only in backend env
// vars (plan §13: "Frontend must never directly access secret SMS credentials").
import { env } from '../../config/env.js';

const MSG91_OTP_URL = 'https://control.msg91.com/api/v5/otp';

export const msg91OtpProvider = {
  async sendOTP(mobile, code) {
    const mobileDigits = mobile.replace('+', ''); // MSG91 expects e.g. 919876543210, no "+"

    const params = new URLSearchParams({
      template_id: env.msg91TemplateId,
      mobile: mobileDigits,
      otp: code,
      ...(env.msg91SenderId ? { sender: env.msg91SenderId } : {}),
    });

    const response = await fetch(`${MSG91_OTP_URL}?${params.toString()}`, {
      method: 'POST',
      headers: { authkey: env.msg91AuthKey, 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`MSG91 OTP send failed (${response.status}): ${body}`);
    }
  },
};
