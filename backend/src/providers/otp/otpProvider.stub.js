// Dev/test provider — logs instead of sending a real SMS. Never logs in a
// production build path (plan §12: "never log OTP in production").
import { isProduction } from '../../config/env.js';

export const stubOtpProvider = {
  async sendOTP(mobile, code) {
    if (isProduction) {
      throw new Error('otpProvider.stub must not be used in production');
    }
    console.log(`[stub OTP] ${mobile} -> ${code}`);
  },
};
