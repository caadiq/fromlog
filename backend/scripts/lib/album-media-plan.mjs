import { randomUUID } from 'node:crypto';

export const mediaFields = {
  album_photos: ['original_url', 'medium_url', 'thumb_url'],
  album_teasers: ['original_url', 'medium_url', 'thumb_url', 'video_url'],
};
const uuidName = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|mp4)$/;

export function buildMediaPlan(snapshot, publicBase) {
  const albums = new Map(snapshot.albums.map(a => [a.id, a.folder_name]));
  const entries = [];
  const objects = [];
  for (const [table, fields] of Object.entries(mediaFields)) {
    for (const row of snapshot[table]) {
      const urls = fields.map(f => row[f]).filter(Boolean);
      if (!urls.length) throw new Error(`No media URLs: ${table}/${row.id}`);
      if (urls.every(u => uuidName.test(u.split('/').pop()))) continue;
      const folder = albums.get(row.album_id);
      if (!folder || folder.includes('/') || folder === '..') throw new Error(`Invalid album folder: ${row.album_id}`);
      const uuid = randomUUID();
      const before = {}, after = {};
      const copies = new Map();
      for (const field of fields) {
        const url = row[field];
        before[field] = url;
        after[field] = url;
        if (!url) continue;
        if (!url.startsWith(`${publicBase}/album/`) || /[?#]/.test(url)) {
          throw new Error(`Unexpected media URL: ${table}/${row.id}/${field}`);
        }
        const sourceKey = decodeURIComponent(url.slice(publicBase.length + 1));
        const extension = sourceKey.split('.').pop();
        if (!['webp', 'mp4'].includes(extension) || (table === 'album_photos' && extension !== 'webp')) {
          throw new Error(`Unsupported media format: ${table}/${row.id}/${field}`);
        }
        const size = extension === 'mp4' ? 'video' : { original_url: 'original', medium_url: 'medium_800', thumb_url: 'thumb_400' }[field];
        if (!size) throw new Error(`Unexpected media field: ${field}`);
        const targetKey = `album/${folder}/${table === 'album_photos' ? 'photo' : 'teaser'}/${size}/${uuid}.${extension}`;
        after[field] = `${publicBase}/${targetKey}`;
        if (copies.has(targetKey) && copies.get(targetKey) !== sourceKey) throw new Error('Conflicting source objects');
        copies.set(targetKey, sourceKey);
      }
      entries.push({ table, id: row.id, albumId: row.album_id, before, after });
      for (const [targetKey, sourceKey] of copies) objects.push({ sourceKey, targetKey });
    }
  }
  return { entries, objects };
}

// Refuse stale plans without replacing any metadata or newly uploaded rows.
export function checkEntry(current, entry, direction) {
  if (!current || current.album_id !== entry.albumId) throw new Error(`Missing/moved row: ${entry.table}/${entry.id}`);
  const source = direction === 'rollback' ? entry.after : entry.before;
  const target = direction === 'rollback' ? entry.before : entry.after;
  const matches = values => Object.keys(values).every(f => current[f] === values[f]);
  if (matches(target)) return false;
  if (!matches(source)) throw new Error(`Media URLs changed since planning: ${entry.table}/${entry.id}`);
  return true;
}
