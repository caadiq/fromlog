import assert from 'node:assert/strict';
import { createServer as createHttpServer, get } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer, loadConfigFromFile } from 'vite';

test('Vite appends the actual peer to forwarded client addresses', async t => {
  const { config } = await loadConfigFromFile({ command: 'serve', mode: 'test' },
    fileURLToPath(new URL('../vite.config.js', import.meta.url)));
  const root = await mkdtemp(path.join(tmpdir(), 'fromlog-proxy-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const upstream = createHttpServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ forwarded: req.headers['x-forwarded-for'] }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => upstream.close(resolve)));
  const target = `http://127.0.0.1:${upstream.address().port}`;
  const vite = await createServer({
    configFile: false,
    root,
    cacheDir: path.join(root, '.cache'),
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: {
      host: '127.0.0.1', port: 0, hmr: false,
      proxy: Object.fromEntries(Object.entries(config.server.proxy)
        .map(([route, settings]) => [route, { ...settings, target }])),
    },
  });
  t.after(() => vite.close());
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  for (const route of ['/api/auth/login', '/docs/']) {
    for (const forwarded of [undefined, '198.51.100.11', '192.0.2.1, 198.51.100.11']) {
      const result = await new Promise((resolve, reject) => {
        get(`${origin}${route}`, {
          headers: forwarded ? { 'X-Forwarded-For': forwarded } : {},
        }, res => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });
      assert.deepEqual(result.forwarded.split(',').map(ip => ip.trim()),
        [...(forwarded ? forwarded.split(',').map(ip => ip.trim()) : []), '127.0.0.1']);
    }
  }
});
