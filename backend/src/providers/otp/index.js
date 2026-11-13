import { env } from '../../config/env.js';
import { stubOtpProvider } from './otpProvider.stub.js';
import { msg91OtpProvider } from './otpProvider.msg91.js';

const providers = {
  stub: stubOtpProvider,
  msg91: msg91OtpProvider,
};

// Swappable via OTP_PROVIDER env var — nothing else in the codebase changes
// when a real provider is chosen. See plan §7/§13.
export const otpProvider = providers[env.otpProvider];

if (!otpProvider) {
  throw new Error(`Unknown OTP_PROVIDER "${env.otpProvider}"`);
}
