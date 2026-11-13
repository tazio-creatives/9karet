import { localStorageProvider } from './storageProvider.local.js';
import { s3StorageProvider } from './storageProvider.s3.js';
import { env } from '../../config/env.js';

const providers = { local: localStorageProvider, s3: s3StorageProvider };

export const storageProvider = providers[env.storageProvider] ?? localStorageProvider;
