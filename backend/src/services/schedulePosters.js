import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import config from '../config/index.js';

// Only image records attached to supported schedules can be reused.
export const scheduleImageLinks = `
  SELECT schedule_id, thumbnail_id AS image_id FROM schedule_variety WHERE thumbnail_id IS NOT NULL
  UNION ALL
  SELECT e.schedule_id, j.image_id FROM schedule_event e,
    JSON_TABLE(COALESCE(e.poster_image_ids, '[]'), '$[*]' COLUMNS(image_id INT PATH '$')) j
  UNION ALL
  SELECT e.schedule_id, j.image_id FROM schedule_etc e,
    JSON_TABLE(COALESCE(e.poster_image_ids, '[]'), '$[*]' COLUMNS(image_id INT PATH '$')) j
  UNION ALL
  SELECT c.schedule_id, s.poster_id FROM schedule_concert c
    JOIN concert_series s ON s.id = c.series_id WHERE s.poster_id IS NOT NULL
`;

const client = new S3Client({
  endpoint: config.s3.endpoint, region: 'us-east-1', forcePathStyle: true,
  credentials: { accessKeyId: config.s3.accessKey, secretAccessKey: config.s3.secretKey },
});
const MAX_BYTES = 10 * 1024 * 1024;

export async function readSchedulePoster(url) {
  const prefix = `${config.s3.publicUrl.replace(/\/$/, '')}/${config.s3.bucket}/`;
  if (typeof url !== 'string' || !url.startsWith(prefix)) throw new Error('Unsupported image location');
  const key = url.slice(prefix.length);
  if (!key || key.includes('..') || /[?#]/.test(key)) throw new Error('Invalid image key');
  const object = await client.send(new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }), { abortSignal: AbortSignal.timeout(15000) });
  const chunks = [];
  let size = 0;
  try {
    if (object.ContentLength > MAX_BYTES) throw new Error('Image too large');
    for await (const chunk of object.Body) {
      size += chunk.length;
      if (size > MAX_BYTES) throw new Error('Image too large');
      chunks.push(chunk);
    }
  } finally { object.Body?.destroy?.(); }
  const buffer = Buffer.concat(chunks);
  const { format } = await sharp(buffer).metadata();
  const mime = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[format];
  if (!mime) throw new Error('Unsupported image format');
  return { dataUrl: `data:${mime};base64,${buffer.toString('base64')}`, mime, extension: format };
}
