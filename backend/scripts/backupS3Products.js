// One-off safety backup before backfillAvifQuality.js --apply runs against
// S3 in production: server-side-copies every object under "products/" to a
// timestamped backup prefix in the same bucket (no data leaves S3, so this
// is fast and doesn't touch egress). Restore = copy the backup prefix back
// over "products/" the same way, object for object.
//
// Usage: node backend/scripts/backupS3Products.js

import { S3Client, ListObjectsV2Command, CopyObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../src/config/env.js';

if (env.storageProvider !== 's3') {
  console.log(`STORAGE_PROVIDER is "${env.storageProvider}", not "s3" — nothing to back up here.`);
  process.exit(0);
}

const client = new S3Client({
  region: env.s3Region,
  ...(env.s3AccessKeyId && env.s3SecretAccessKey
    ? { credentials: { accessKeyId: env.s3AccessKeyId, secretAccessKey: env.s3SecretAccessKey } }
    : {}),
});

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupPrefix = `backup-preavif-${ts}/products/`;

async function main() {
  let continuationToken;
  let total = 0;
  let copied = 0;

  do {
    const { Contents, IsTruncated, NextContinuationToken } = await client.send(
      new ListObjectsV2Command({ Bucket: env.s3Bucket, Prefix: 'products/', ContinuationToken: continuationToken }),
    );
    for (const obj of Contents ?? []) {
      total++;
      const destKey = backupPrefix + obj.Key.slice('products/'.length);
      await client.send(
        new CopyObjectCommand({
          Bucket: env.s3Bucket,
          CopySource: `${env.s3Bucket}/${encodeURIComponent(obj.Key)}`,
          Key: destKey,
        }),
      );
      copied++;
      if (copied % 25 === 0) console.log(`  ...${copied}`);
    }
    continuationToken = IsTruncated ? NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`\nBacked up ${copied}/${total} object(s) to s3://${env.s3Bucket}/${backupPrefix}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
