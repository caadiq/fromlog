import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { createProxyTrust } from '../src/utils/proxyTrust.js';

test('trust only resolved peers; refresh removes old or failed DNS addresses', async t => {
  let address = '172.25.0.19';
  let failed = false;
  const failures = [];
  const proxy = createProxyTrust(['frontend', 'caddy'], {
    resolve: async name => {
      if (name === 'caddy') return [{ address: '2001:db8::22' }];
      if (failed) throw new Error('DNS unavailable');
      return [{ address }];
    },
    onError: name => failures.push(name),
  });
  const app = Fastify({ trustProxy: proxy.trustProxy }); t.after(() => app.close());
  app.get('/', request => ({ ip: request.ip }));
  const ip = async (peer, xff) => (await app.inject({ url: '/', remoteAddress: peer, headers: { 'x-forwarded-for': xff } })).json().ip;
  assert.equal(await ip(address, '198.51.100.11'), address);
  await proxy.refresh();
  assert.equal(await ip('::ffff:172.25.0.19', '198.51.100.11, 2001:db8::22'), '198.51.100.11');
  assert.equal(await ip('172.25.0.99', '198.51.100.11, 2001:db8::22'), '172.25.0.99');
  // Direct-to-frontend clients append their own peer address; never trust their prefix.
  assert.equal(await ip(address, '198.51.100.11, 172.25.0.99'), '172.25.0.99');
  address = '172.25.0.29';
  await proxy.refresh();
  assert.equal(await ip('172.25.0.19', '198.51.100.11'), '172.25.0.19');
  assert.equal(await ip(address, '198.51.100.11'), '198.51.100.11');
  failed = true;
  await proxy.refresh();
  assert.equal(await ip(address, '198.51.100.11'), address);
  assert.equal(await ip('2001:db8::22', '198.51.100.11'), '198.51.100.11');
  assert.deepEqual(failures, ['frontend']);
});

test('empty trusted-peer configuration ignores all forwarding headers', async t => {
  const proxy = createProxyTrust([], { resolve: () => { throw new Error('No DNS expected'); } });
  await proxy.refresh();
  const app = Fastify({ trustProxy: proxy.trustProxy }); t.after(() => app.close());
  app.get('/', request => ({ ip: request.ip }));
  assert.equal((await app.inject({ url: '/', remoteAddress: '127.0.0.1', headers: { 'x-forwarded-for': '198.51.100.11' } })).json().ip, '127.0.0.1');
});
