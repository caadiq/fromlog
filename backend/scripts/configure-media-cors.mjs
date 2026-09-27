// Read-only by default. Apply only the public media read rule and keep other rules.
import { readFile, writeFile } from 'node:fs/promises';
import { S3Client, GetBucketCorsCommand, PutBucketCorsCommand, DeleteBucketCorsCommand } from '@aws-sdk/client-s3';
import config from '../src/config/index.js';
const client = new S3Client({ endpoint: config.s3.endpoint, region: 'us-east-1', forcePathStyle: true,
  credentials: { accessKeyId: config.s3.accessKey, secretAccessKey: config.s3.secretKey } });
const Bucket = config.s3.bucket;
if (Bucket !== 'fromis-9') throw new Error('Expected the fromlog media bucket');
const rule = { ID: 'fromlog-public-media-read', AllowedOrigins: ['https://fromlog.caadiq.co.kr', 'https://dev.fromlog.caadiq.co.kr'],
  AllowedMethods: ['GET', 'HEAD'], AllowedHeaders: ['Range'], ExposeHeaders: ['Content-Length', 'Content-Type', 'Content-Disposition', 'ETag'], MaxAgeSeconds: 3600 };
async function read() {
  try { return (await client.send(new GetBucketCorsCommand({ Bucket }))).CORSRules || []; }
  catch (error) { if (error.name === 'NoSuchCORSConfiguration') return []; throw error; }
}
const args = process.argv.slice(2), current = await read();
if (args[0] === '--apply' && args[1]) {
  await writeFile(args[1], JSON.stringify({ Bucket, rules: current }, null, 2), { flag: 'wx', mode: 0o600 });
  const rules = [...current.filter(item => item.ID !== rule.ID), rule];
  await client.send(new PutBucketCorsCommand({ Bucket, CORSConfiguration: { CORSRules: rules } }));
} else if (args[0] === '--restore' && args[1]) {
  const backup = JSON.parse(await readFile(args[1], 'utf8'));
  if (backup.Bucket !== Bucket || !Array.isArray(backup.rules)) throw new Error('Invalid CORS backup');
  // Refuse to discard unrelated edits made after the backup.
  if (JSON.stringify(current.filter(item => item.ID !== rule.ID)) !== JSON.stringify(backup.rules.filter(item => item.ID !== rule.ID))) throw new Error('Other rules changed; review before restoring');
  await client.send(backup.rules.length ? new PutBucketCorsCommand({ Bucket, CORSConfiguration: { CORSRules: backup.rules } }) : new DeleteBucketCorsCommand({ Bucket }));
} else if (args.length) throw new Error('Usage: [--apply backup.json | --restore backup.json]');
console.log(JSON.stringify({ Bucket, rules: await read() }, null, 2));
