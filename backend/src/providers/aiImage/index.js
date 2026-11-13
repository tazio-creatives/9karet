import { stubAiImageProvider } from './aiImageProvider.stub.js';
import { env } from '../../config/env.js';

const providers = { stub: stubAiImageProvider };

export const aiImageProvider = providers[env.aiImageProvider] ?? stubAiImageProvider;
