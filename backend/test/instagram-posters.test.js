import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import Fastify from 'fastify';
import instagramRoutes from '../src/routes/admin/instagram.js';
import { normalizeInstagramPost, isInstagramImageUrl, extractInstagramImages, importInstagramPosters } from '../src/services/instagramPosters.js';

const photo = 'https://scontent-example.cdninstagram.com/photo.jpg';
const embed = (media) => `{"contextJSON":${JSON.stringify(JSON.stringify({ gql_data: { shortcode_media: media } }))}}`;

test('accepts post links and discards tracking; rejects arbitrary hosts, credentials and paths', () => {
  assert.equal(normalizeInstagramPost('https://www.instagram.com/p/Ab_-12/?img_index=2#x'), 'https://www.instagram.com/p/Ab_-12/');
  assert.equal(normalizeInstagramPost('https://m.instagram.com/reel/Ab1/'), 'https://www.instagram.com/reel/Ab1/');
  for (const url of [null, {}, 'http://www.instagram.com/p/Ab/', 'https://www.instagram.com.evil.test/p/Ab/', 'https://user@www.instagram.com/p/Ab/', 'https://www.instagram.com:444/p/Ab/', 'https://www.instagram.com/accounts/login/', 'https://127.0.0.1/p/Ab/']) assert.throws(() => normalizeInstagramPost(url));
});

test('CDN allowlist rejects redirects to arbitrary destinations and deceptive names', () => {
  assert.ok(isInstagramImageUrl(photo));
  assert.ok(isInstagramImageUrl('https://scontent.xx.fbcdn.net/a.jpg'));
  for (const url of ['https://cdninstagram.com.evil.test/a', 'http://s.cdninstagram.com/a', 'https://s.cdninstagram.com:444/a', 'https://user@s.cdninstagram.com/a', 'https://localhost/a']) assert.equal(isInstagramImageUrl(url), false);
});

test('extracts full carousel in order, deduplicates and excludes video thumbnails', () => {
  assert.deepEqual(extractInstagramImages(embed({ edge_sidecar_to_children: { edges: [
    { node: { display_url: photo } }, { node: { display_url: `${photo}?2` } },
    { node: { display_url: photo } }, { node: { display_url: `${photo}?video`, is_video: true } },
  ] } })), [photo, `${photo}?2`]);
  assert.deepEqual(extractInstagramImages(embed({ display_url: photo })), [photo]);
  assert.throws(() => extractInstagramImages('login required'));
  assert.throws(() => extractInstagramImages(embed({ display_url: 'https://127.0.0.1/private' })));
  assert.throws(() => extractInstagramImages(embed({ is_video: true, display_url: photo })));
  assert.throws(() => extractInstagramImages(embed({ edge_sidecar_to_children: { edges: Array.from({ length: 21 }, (_, i) => ({ node: { display_url: `${photo}?${i}` } })) } })));
});

test('downloads validated images as local JPEG data; preserves order and disables redirects', async () => {
  const png = await sharp({ create: { width: 12, height: 18, channels: 3, background: '#336699' } }).png().toBuffer();
  const calls = [];
  const result = await importInstagramPosters('https://www.instagram.com/p/Test/?img_index=2', { fetcher: async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, 'error');
    return new Response(url.endsWith('/embed/') ? embed({ display_url: photo }) : png);
  } });
  assert.deepEqual(calls, ['https://www.instagram.com/p/Test/embed/', photo]);
  assert.equal(result.images[0].name, 'instagram-Test-1.jpg');
  const metadata = await sharp(Buffer.from(result.images[0].dataUrl.split(',')[1], 'base64')).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.width, 12);
});

test('rejects large bodies with and without Content-Length, bad images, redirects and aborted requests', async () => {
  const url = 'https://www.instagram.com/p/Test/';
  await assert.rejects(importInstagramPosters(url, { fetcher: async () => new Response('x', { headers: { 'content-length': 5000000 } }) }));
  await assert.rejects(importInstagramPosters(url, { fetcher: async () => new Response('x'.repeat(5 * 1024 * 1024)) }));
  await assert.rejects(importInstagramPosters(url, { fetcher: async (target) => new Response(target.endsWith('/embed/') ? embed({ display_url: photo }) : 'not an image') }));
  await assert.rejects(importInstagramPosters(url, { fetcher: async () => new Response('', { status: 302, headers: { location: 'http://127.0.0.1/' } }) }));
  await assert.rejects(importInstagramPosters(url, { signal: AbortSignal.abort(), fetcher: async () => new Response(embed({ display_url: photo })) }));
});

test('admin endpoint requires authentication, validates input, logs failures without external URL contents', async () => {
  const api = Fastify();
  const logs = [];
  api.decorate('db', { query: async (...args) => logs.push(args) });
  api.decorate('authenticate', async (request, reply) => { if (request.headers.authorization !== 'Bearer test') return reply.code(401).send({ error: 'unauthorized' }); });
  await api.register(instagramRoutes, { prefix: '/admin/instagram' });
  const originalFetch = globalThis.fetch;
  try {
    assert.equal((await api.inject({ method: 'POST', url: '/admin/instagram/posters', payload: { url: 'https://www.instagram.com/p/Test/' } })).statusCode, 401);
    assert.equal((await api.inject({ method: 'POST', url: '/admin/instagram/posters', headers: { authorization: 'Bearer test' }, payload: { url: 'https://example.com' } })).statusCode, 400);
    globalThis.fetch = async () => { throw new Error('sensitive upstream contents'); };
    const response = await api.inject({ method: 'POST', url: '/admin/instagram/posters', headers: { authorization: 'Bearer test' }, payload: { url: 'https://www.instagram.com/p/Test/?tracking=secret' } });
    assert.equal(response.statusCode, 502);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(logs.length, 1);
    assert.ok(!JSON.stringify(logs).includes('secret'));
    assert.ok(!response.body.includes('sensitive'));
  } finally { globalThis.fetch = originalFetch; await api.close(); }
});

test('admin import returns files without storing schedules and prevents overlapping imports', async () => {
  const api = Fastify();
  const queries = [];
  api.decorate('db', { query: async (...args) => queries.push(args) });
  api.decorate('authenticate', async () => {});
  await api.register(instagramRoutes, { prefix: '/admin/instagram' });
  const png = await sharp({ create: { width: 12, height: 18, channels: 3, background: '#336699' } }).png().toBuffer();
  const originalFetch = globalThis.fetch;
  let release, started;
  const wait = new Promise((resolve) => { release = resolve; });
  const ready = new Promise((resolve) => { started = resolve; });
  globalThis.fetch = async (url) => {
    started();
    await wait;
    return new Response(url.endsWith('/embed/') ? embed({ display_url: photo }) : png);
  };
  try {
    const request = { method: 'POST', url: '/admin/instagram/posters', payload: { url: 'https://www.instagram.com/p/Test/' } };
    const first = api.inject(request).then((response) => response);
    await ready;
    assert.equal((await api.inject(request)).statusCode, 429);
    release();
    const response = await first;
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().images.length, 1);
    assert.match(response.json().images[0].dataUrl, /^data:image\/jpeg;base64,/);
    assert.equal((await api.inject(request)).statusCode, 200);
    assert.equal(queries.length, 2);
    assert.ok(queries.every(([sql]) => sql.startsWith('INSERT INTO logs')));
  } finally { release(); globalThis.fetch = originalFetch; await api.close(); }
});
