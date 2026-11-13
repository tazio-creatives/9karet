import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';

// Dev provider — plain disk (plan §2: "local disk in dev, S3-compatible in
// prod"). Swapping to S3 later means implementing this same
// save/read/delete interface against S3's SDK — nothing above this layer
// (image processing, admin endpoints) changes.
const root = path.resolve(process.cwd(), env.uploadDir);

export const localStorageProvider = {
  name: 'local',

  urlFor(key) {
    return `${env.uploadsPublicBaseUrl}/${key}`;
  },

  async save(key, buffer) {
    const filePath = path.join(root, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return { key, url: this.urlFor(key) };
  },

  async read(key) {
    return fs.readFile(path.join(root, key));
  },

  async delete(key) {
    await fs.rm(path.join(root, key), { force: true });
  },
};
