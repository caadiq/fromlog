import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import http from 'node:http';
import { createPublicTextFetcher, isPublicAddress } from '../src/utils/publicFetch.js';
import { fetchOgCard, fetchTiktokThumbnail } from '../src/services/x/og.js';
import { withIngestionLock } from '../src/utils/youtubeLock.js';

const publicDns = async () => [{ address: '93.184.216.34', family: 4 }];
function fixture(responses, lookup = publicDns) {
  const calls = [];
  const streams = [];
  const fetchText = createPublicTextFetcher({ lookup, request(url, options, callback) {
    calls.push({ url: url.href, options });
    const res = new PassThrough();
    const req = new EventEmitter();
    streams.push(res);
    req.end = () => queueMicrotask(() => {
      const spec = responses[calls.length - 1] || {};
      res.statusCode = spec.status ?? 200;
      res.headers = spec.headers || {};
      callback(res);
      if (!res.destroyed) {
        if (spec.hang) res.write('partial');
        else res.end(spec.body ?? 'ok');
      }
    });
    const abort = () => { res.destroy(); req.emit('error', options.signal.reason); };
    options.signal.addEventListener('abort', abort, { once: true });
    res.on('close', () => options.signal.removeEventListener('abort', abort));
    return req;
  } });
  return { fetchText, calls, streams };
}

test('only public IPv4 and ordinary global IPv6 addresses are allowed', () => {
  for (const address of ['8.8.8.8', '93.184.216.34', '2606:4700::1111', '2001:4860:4860::8888']) assert.equal(isPublicAddress(address), true, address);
  for (const address of ['0.1.2.3', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.31.0.1', '192.168.1.1', '192.0.0.8', '192.0.2.1', '192.88.99.1', '198.19.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255', '::', '::1', '::ffff:127.0.0.1', '::ffff:8.8.8.8', 'fc00::1', 'fe80::1', 'ff02::1', '64:ff9b::7f00:1', '2002:7f00:1::', '2001::1', '2001:db8::1', '3fff::1', 'invalid']) assert.equal(isPublicAddress(address), false, address);
});

test('URL aliases, schemes, credentials and nonstandard ports fail before connecting', async () => {
  const f = fixture([]);
  for (const url of ['http://127.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://0177.0.0.1/', 'https://[::ffff:127.0.0.1]/', 'http://[::1]/', 'file:///etc/passwd', 'ftp://example.com/', 'https://user:pass@example.com/', 'https://example.com:444/']) await assert.rejects(f.fetchText(url));
  assert.equal(f.calls.length, 0);
});

test('DNS private, mixed, empty and failed resolution are rejected', async () => {
  for (const results of [[], [{ address: '127.0.0.1', family: 4 }], [...await publicDns(), { address: '10.0.0.1', family: 4 }], [{ address: 'fd00::1', family: 6 }]]) {
    const f = fixture([], async () => results);
    await assert.rejects(f.fetchText('https://example.test/'));
    assert.equal(f.calls.length, 0);
  }
  await assert.rejects(fixture([], async () => { throw Error('DNS failed'); }).fetchText('https://example.test/'), /DNS failed/);
});

test('socket lookup uses the checked address without resolving a second time', async () => {
  let resolutions = 0;
  const f = fixture([{ body: 'hello' }], async () => ++resolutions === 1 ? publicDns() : [{ address: '127.0.0.1', family: 4 }]);
  assert.equal((await f.fetchText('https://example.test/path#fragment')).text, 'hello');
  const { options, url } = f.calls[0];
  assert.equal(url, 'https://example.test/path');
  assert.equal(options.agent, false);
  assert.equal(options.headers['Accept-Encoding'], 'identity');
  options.lookup('example.test', {}, (err, address, family) => { assert.equal(err, null); assert.equal(address, '93.184.216.34'); assert.equal(family, 4); });
  options.lookup('example.test', { all: true }, (err, addresses) => { assert.equal(err, null); assert.deepEqual(addresses, [{ address: '93.184.216.34', family: 4 }]); });
  assert.equal(resolutions, 1);
});

test('relative public redirects work and revalidate DNS for every hop', async () => {
  let resolutions = 0;
  const f = fixture([{ status: 302, headers: { location: '/next' } }, { body: 'final' }], async () => { resolutions++; return publicDns(); });
  assert.deepEqual(await f.fetchText('https://example.test/start'), { url: 'https://example.test/next', text: 'final' });
  assert.equal(resolutions, 2);
  assert.equal(f.streams[0].destroyed, true);
});

test('redirects to literal or DNS-resolved internal destinations never connect', async () => {
  for (const location of ['http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'https://[::1]/', 'http://internal.test/', 'https://example.test:9000/', 'file:///etc/passwd']) {
    const f = fixture([{ status: 302, headers: { location } }], async hostname => hostname === 'internal.test' ? [{ address: '10.0.0.4', family: 4 }] : publicDns());
    await assert.rejects(f.fetchText('https://example.test/'));
    assert.equal(f.calls.length, 1);
  }
});

test('same-host DNS rebinding on redirect is rejected', async () => {
  let calls = 0;
  const f = fixture([{ status: 302, headers: { location: '/second' } }], async () => ++calls === 1 ? publicDns() : [{ address: '127.0.0.1', family: 4 }]);
  await assert.rejects(f.fetchText('https://example.test/'), /Non-public/);
  assert.equal(f.calls.length, 1);
});

test('missing redirect location and redirect loops are bounded', async () => {
  await assert.rejects(fixture([{ status: 301 }]).fetchText('https://example.test/'), /redirect/);
  const f = fixture(Array.from({ length: 6 }, () => ({ status: 302, headers: { location: '/' } })));
  await assert.rejects(f.fetchText('https://example.test/'), /redirect/);
  assert.equal(f.calls.length, 5);
});

test('declared and actual response sizes are bounded, including multibyte text', async () => {
  for (const response of [{ headers: { 'content-length': '100' }, hang: true }, { body: 'x'.repeat(20) }, { body: '가나다라마' }]) {
    const f = fixture([response]);
    await assert.rejects(f.fetchText('https://example.test/', { maxBytes: 10 }), /too large/);
    assert.equal(f.streams[0].destroyed, true);
  }
  assert.equal((await fixture([{ body: '가나다' }]).fetchText('https://example.test/', { maxBytes: 9 })).text, '가나다');
});

test('unexpected compressed and unsuccessful responses are discarded', async () => {
  for (const response of [{ headers: { 'content-encoding': 'gzip' } }, { status: 404 }, { status: 500 }]) await assert.rejects(fixture([response]).fetchText('https://example.test/'));
});

test('deadline includes DNS and no connection happens after a late DNS resolution', async () => {
  let finish;
  const f = fixture([], () => new Promise(resolve => { finish = resolve; }));
  await assert.rejects(f.fetchText('https://example.test/', { timeoutMs: 20 }), /deadline/);
  finish(await publicDns());
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.calls.length, 0);
});

test('deadline cancels a body after successful headers and releases ingestion resources', async () => {
  let releases = 0;
  const db = { getConnection: async () => ({ query: async () => [[{ acquired: 1 }]], release: () => releases++ }) };
  const fixtures = Array.from({ length: 3 }, () => fixture([{ hang: true }]));
  const jobs = fixtures.map((f, i) => withIngestionLock(db, `test${i}`, () => fetchOgCard('https://example.test/', { fetchText: url => f.fetchText(url, { timeoutMs: 30 }) })));
  const next = withIngestionLock(db, 'next', async () => 'next ran');
  assert.deepEqual(await Promise.all(jobs), [null, null, null]);
  assert.equal(await next, 'next ran');
  assert.equal(releases, 4);
  assert.ok(fixtures.every(f => f.streams[0].destroyed));
});

test('real Node HTTP transport aborts stalled body and accepts ordinary text', async t => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    if (req.url === '/hang') res.write('partial'); else res.end('normal');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const fetchText = createPublicTextFetcher({ lookup: publicDns, request: (url, options, cb) => http.request({ ...options, hostname: '127.0.0.1', port: server.address().port, path: url.pathname }, cb) });
  await assert.rejects(fetchText('http://example.test/hang', { timeoutMs: 40 }), /deadline|abort/i);
  assert.equal((await fetchText('http://example.test/normal')).text, 'normal');
});

test('OG parsing retains metadata and final destination; rejected URLs simply omit enrichment', async () => {
  const f = fixture([{ body: '<meta property="og:title" content="Title &amp; more"><meta content="https://images.test/a.jpg" property="og:image"><meta name="og:description" content="Description">' }]);
  assert.deepEqual(await fetchOgCard('https://example.test/', { fetchText: f.fetchText }), { url: 'https://example.test/', title: 'Title & more', description: 'Description', destination: 'example.test', image: 'https://images.test/a.jpg' });
  assert.equal(await fetchOgCard('http://127.0.0.1/'), null);
  assert.equal(await fetchOgCard('https://example.test/', { fetchText: fixture([{ body: 'no metadata' }]).fetchText }), null);
});

test('TikTok keeps a fixed oEmbed origin and bounded JSON parsing', async () => {
  const calls = [];
  assert.equal(await fetchTiktokThumbnail('https://vt.tiktok.com/id?x=1', { fetchText: async (url, options) => { calls.push({ url, options }); return { text: '{"thumbnail_url":"https://images.test/a.jpg"}' }; } }), 'https://images.test/a.jpg');
  assert.equal(new URL(calls[0].url).origin, 'https://www.tiktok.com');
  assert.equal(calls[0].options.maxBytes, 256 * 1024);
  assert.equal(await fetchTiktokThumbnail('test', { fetchText: async () => ({ text: 'invalid json' }) }), null);
});
