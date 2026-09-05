import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import Redis from 'ioredis';
import { S3Client, HeadObjectCommand, GetObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import config from '../src/config/index.js';
import { withTransaction } from '../src/utils/transaction.js';
import { invalidatePattern } from '../src/utils/cache.js';
import { logActivity } from '../src/utils/log.js';
import { buildMediaPlan, checkEntry, mediaFields } from './lib/album-media-plan.mjs';

const [action, directory] = process.argv.slice(2);
if (!['plan', 'copy', 'apply', 'verify', 'rollback'].includes(action) || !directory) {
  throw new Error('Usage: node scripts/migrate-album-media-ids.mjs plan|copy|apply|verify|rollback BACKUP_DIRECTORY');
}
const db = mysql.createPool(config.db);
const s3 = new S3Client({
  endpoint: config.s3.endpoint, region: 'us-east-1', forcePathStyle: true,
  credentials: { accessKeyId: config.s3.accessKey, secretAccessKey: config.s3.secretKey },
});
const Bucket = config.s3.bucket;
const publicBase = `${config.s3.publicUrl.replace(/\/$/, '')}/${Bucket}`;
const manifestPath = path.join(directory, 'manifest.json');
const progressPath = path.join(directory, 'copied.json');

async function save(file, value) {
  await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(`${file}.tmp`, file);
}
async function read(file) { return JSON.parse(await readFile(file, 'utf8')); }
async function head(Key) {
  try { return await s3.send(new HeadObjectCommand({ Bucket, Key })); }
  catch (error) { if (error.$metadata?.httpStatusCode === 404) return null; throw error; }
}
async function digest(Key, etag) {
  const { Body } = await s3.send(new GetObjectCommand({ Bucket, Key, IfMatch: etag }));
  const hash = createHash('sha256');
  for await (const chunk of Body) hash.update(chunk);
  return hash.digest('hex');
}
async function batches(items, fn, saved) {
  for (let i = 0; i < items.length; i += 4) {
    await Promise.all(items.slice(i, i + 4).map(fn));
    if (saved) await saved();
    if (i % 100 === 0 || i + 4 >= items.length) console.log(`${action}: ${Math.min(i + 4, items.length)}/${items.length}`);
  }
}
async function snapshot() {
  return withTransaction(db, async conn => {
    const data = {};
    for (const table of ['albums', 'album_photos', 'album_teasers', 'album_photo_members']) {
      const [rows] = await conn.query(`SELECT ${table === 'albums' ? 'id, folder_name' : '*'} FROM ${table} ORDER BY id`);
      data[table] = rows;
    }
    return data;
  });
}
async function invalidateCaches() {
  const redis = new Redis({ ...config.redis, lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    await invalidatePattern(redis, 'album:*');
    await redis.del('albums:all');
  } finally { redis.disconnect(); }
}
async function verifyObject(object, progress, source = false, hash = false) {
  const key = source ? object.sourceKey : object.targetKey;
  const recorded = progress[object.targetKey];
  if (!recorded) throw new Error(`Copy has not been verified: ${object.targetKey}`);
  const metadata = await head(key);
  if (!metadata || metadata.ContentLength !== object.size || metadata.ETag !== (source ? object.etag : recorded.etag)) {
    throw new Error(`Object missing or changed: ${key}`);
  }
  if (hash && await digest(key, metadata.ETag) !== recorded.sha256) throw new Error(`Checksum mismatch: ${key}`);
}
async function applyUrls(manifest, direction) {
  await withTransaction(db, async conn => {
    // Check every row first. Commit all URL replacements together.
    const pending = [];
    for (const entry of manifest.entries) {
      const [[album]] = await conn.query('SELECT folder_name FROM albums WHERE id = ? FOR UPDATE', [entry.albumId]);
      const originalAlbum = manifest.snapshot.albums.find(a => a.id === entry.albumId);
      if (album?.folder_name !== originalAlbum.folder_name) throw new Error(`Album folder changed: ${entry.albumId}`);
      const [[current]] = await conn.query('SELECT * FROM ?? WHERE id = ? FOR UPDATE', [entry.table, entry.id]);
      if (checkEntry(current, entry, direction)) pending.push(entry);
    }
    for (const entry of pending) {
      const values = direction === 'rollback' ? entry.before : entry.after;
      const fields = mediaFields[entry.table];
      await conn.query(`UPDATE ?? SET ${fields.map(f => `\`${f}\` = ?`).join(', ')} WHERE id = ?`,
        [entry.table, ...fields.map(f => values[f]), entry.id]);
    }
  });
  // If this fails, rerunning apply/rollback safely retries cache invalidation.
  await invalidateCaches();
  await logActivity(db, {
    actor: 'admin', action: 'update', category: 'album', targetType: 'media_migration',
    summary: `앨범 미디어 UUID ${direction === 'rollback' ? '복구' : '이전'}: ${manifest.entries.length}건`,
    details: { migrationId: manifest.createdAt, entries: manifest.entries.length, objects: manifest.objects.length },
  });
  await save(path.join(directory, `${direction}.json`), { completedAt: new Date().toISOString(), entries: manifest.entries.length });
}

try {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (action === 'plan') {
    const original = await snapshot();
    // Exclusive creation prevents replacing the original backup or UUID mapping.
    await writeFile(path.join(directory, 'snapshot.json'), JSON.stringify(original, null, 2), { flag: 'wx', mode: 0o600 });
    const plan = buildMediaPlan(original, publicBase);
    const manifest = { createdAt: new Date().toISOString(), database: config.db.database, bucket: Bucket, publicBase, snapshot: original, ...plan };
    await batches(manifest.objects, async object => {
      const [source, target] = await Promise.all([head(object.sourceKey), head(object.targetKey)]);
      if (!source) throw new Error(`Source missing: ${object.sourceKey}`);
      if (target) throw new Error(`Target already exists: ${object.targetKey}`);
      object.etag = source.ETag;
      object.size = source.ContentLength;
      object.contentType = source.ContentType;
    });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify({ entries: manifest.entries.length, objects: manifest.objects.length, bytes: manifest.objects.reduce((sum, o) => sum + o.size, 0) }));
  } else {
    const manifest = await read(manifestPath);
    if (manifest.database !== config.db.database || manifest.bucket !== Bucket || manifest.publicBase !== publicBase) throw new Error('Migration environment differs from backup');
    let progress;
    try { progress = await read(progressPath); } catch (e) { if (e.code !== 'ENOENT') throw e; progress = {}; }
    if (action === 'copy') {
      await batches(manifest.objects, async object => {
        if (progress[object.targetKey]) return verifyObject(object, progress);
        const source = await head(object.sourceKey);
        if (!source || source.ETag !== object.etag || source.ContentLength !== object.size) throw new Error(`Source changed: ${object.sourceKey}`);
        const sha256 = await digest(object.sourceKey, object.etag);
        let target = await head(object.targetKey);
        if (!target) {
          await s3.send(new CopyObjectCommand({
            Bucket, Key: object.targetKey,
            CopySource: `${Bucket}/${object.sourceKey.split('/').map(encodeURIComponent).join('/')}`,
            CopySourceIfMatch: object.etag, MetadataDirective: 'COPY',
          }));
          target = await head(object.targetKey);
        }
        if (!target || target.ContentLength !== object.size || target.ContentType !== object.contentType || await digest(object.targetKey, target.ETag) !== sha256) {
          throw new Error(`Copied file differs from original: ${object.targetKey}`);
        }
        progress[object.targetKey] = { sha256, etag: target.ETag, size: target.ContentLength };
      }, () => save(progressPath, progress));
    } else if (action === 'apply' || action === 'rollback') {
      await batches(manifest.objects, object => verifyObject(object, progress, action === 'rollback', action === 'rollback'));
      await applyUrls(manifest, action);
      console.log(`${action}: committed ${manifest.entries.length} rows; original files retained`);
    } else {
      await batches(manifest.objects, object => verifyObject(object, progress, false, true));
      const current = JSON.parse(JSON.stringify(await snapshot()));
      for (const entry of manifest.entries) {
        const row = current[entry.table].find(r => r.id === entry.id);
        if (checkEntry(row, entry, 'apply')) throw new Error(`Row not migrated: ${entry.table}/${entry.id}`);
        const before = manifest.snapshot[entry.table].find(r => r.id === entry.id);
        for (const field of Object.keys(before).filter(f => !mediaFields[entry.table].includes(f))) {
          if (JSON.stringify(row[field]) !== JSON.stringify(before[field])) throw new Error(`Metadata changed: ${entry.table}/${entry.id}/${field}`);
        }
      }
      if (JSON.stringify(current.album_photo_members) !== JSON.stringify(manifest.snapshot.album_photo_members)) throw new Error('Photo member tags changed');
      await save(path.join(directory, 'verified.json'), { verifiedAt: new Date().toISOString(), entries: manifest.entries.length, objects: manifest.objects.length });
      console.log(`verify: ${manifest.entries.length} rows, metadata/tags and ${manifest.objects.length} SHA-256 checks passed`);
    }
  }
} finally {
  s3.destroy();
  await db.end();
}
