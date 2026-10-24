import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';

// Prod provider — same save/read/delete interface as storageProvider.local.js
// (plan §2: "local disk in dev, S3-compatible in prod"), nothing above this
// layer changes. Credentials are read from AWS_ACCESS_KEY_ID/
// AWS_SECRET_ACCESS_KEY when set; if unset (e.g. an EC2 host with an
// attached IAM role instead), the SDK's default credential chain picks up
// the instance role automatically — never hardcode credentials here.
let client = null;
function getClient() {
  if (!client) {
    client = new S3Client({
      region: env.s3Region,
      ...(env.s3AccessKeyId && env.s3SecretAccessKey
        ? { credentials: { accessKeyId: env.s3AccessKeyId, secretAccessKey: env.s3SecretAccessKey } }
        : {}),
    });
  }
  return client;
}

function publicUrlFor(key) {
  const base = env.s3PublicBaseUrl || `https://${env.s3Bucket}.s3.${env.s3Region}.amazonaws.com`;
  return `${base.replace(/\/$/, '')}/${key}`;
}

// Unlike local disk (served through nginx/Express static, which infer
// Content-Type from the extension automatically), S3 stores exactly the
// metadata it's given — an unset ContentType defaults to
// binary/octet-stream, which makes browsers download instead of render the
// image inline. save()'s signature stays (key, buffer) to match the local
// provider exactly, so this is inferred from the key's own extension rather
// than threading a new parameter through every call site.
const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
};

function contentTypeFor(key) {
  const ext = key.slice(key.lastIndexOf('.')).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// New uploads go under S3_KEY_PREFIX (e.g. "9karet/products/…"). Callers
// keep passing their usual relative keys; save() returns the full key, and
// everything that reads or deletes later uses that full key (or one taken
// back from the stored URL), so read()/delete() take keys as they are.
function withPrefix(key) {
  const prefix = env.s3KeyPrefix;
  if (!prefix || key.startsWith(`${prefix}/`)) return key;
  return `${prefix}/${key}`;
}

export const s3StorageProvider = {
  name: 's3',

  urlFor: publicUrlFor,

  async save(key, buffer) {
    const fullKey = withPrefix(key);
    await getClient().send(
      new PutObjectCommand({ Bucket: env.s3Bucket, Key: fullKey, Body: buffer, ContentType: contentTypeFor(fullKey) }),
    );
    return { key: fullKey, url: publicUrlFor(fullKey) };
  },

  async read(key) {
    const { Body } = await getClient().send(
      new GetObjectCommand({ Bucket: env.s3Bucket, Key: key }),
    );
    return streamToBuffer(Body);
  },

  async delete(key) {
    await getClient().send(new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: key }));
  },
};
