import { stubEmailProvider } from './emailProvider.stub.js';
import { sesEmailProvider } from './emailProvider.ses.js';
import { smtpEmailProvider } from './emailProvider.smtp.js';
import { env } from '../../config/env.js';

const providers = { stub: stubEmailProvider, ses: sesEmailProvider, smtp: smtpEmailProvider };

export const emailProvider = providers[env.emailProvider] ?? stubEmailProvider;
