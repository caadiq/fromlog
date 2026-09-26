import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { createHash } from 'node:crypto';
import { createProxyTrust } from '../src/utils/proxyTrust.js';

// All authentication tests use disposable credentials and an in-memory database.
process.env.JWT_SECRET = 'isolated-auth-test-secret-not-used-by-the-server';
process.env.GOOGLE_OAUTH_CLIENT_ID = 'auth-test-client';
process.env.ADMIN_GOOGLE_EMAILS = 'allowed@example.test';
const { default: config } = await import('../src/config/index.js');
config.google.oauthClientId = 'auth-test-client';
config.google.adminEmails = ['allowed@example.test'];
const { default: auth } = await import('../src/plugins/auth.js');
const { default: routes } = await import('../src/routes/auth.js');
const hash = await bcrypt.hash('correct-test-password', 4);

async function fixture(options = {}) {
  const app = Fastify(options);
  let exists = true, failDb = false;
  const revoked = new Set();
  app.decorate('db', { query: async (sql, params = []) => {
    if (failDb) throw new Error('simulated unavailable database');
    if (sql.includes('revoked_admin_tokens')) {
      if (sql.startsWith('INSERT')) { revoked.add(params[0]); return [{ affectedRows: 1 }]; }
      if (sql.startsWith('DELETE')) return [{ affectedRows: 0 }];
      return [revoked.has(params[0]) ? [{ token_hash: params[0] }] : []];
    }
    if (sql.includes('admin_users')) {
      const found = exists && (!params.length || params[0] === 'test-admin' || params[0] === 7);
      return [found ? [{ id: 7, username: 'test-admin', password_hash: hash }] : []];
    }
    if (sql.includes('INSERT INTO logs')) return [{ affectedRows: 1 }];
    throw new Error(`Unexpected query: ${sql}`);
  } });
  await app.register(rateLimit, { global: false });
  await app.register(auth);
  await app.register(routes, { prefix: '/api/auth' });
  app.get('/protected', { preHandler: app.authenticate }, async () => ({ secret: true }));
  await app.ready();
  return { app, revoked, removeUser: () => { exists = false; }, failDb: () => { failDb = true; } };
}
const bearer = token => ({ authorization: `Bearer ${token}` });

test('logout rejects equivalent signature encodings and preserves legacy revocations', async t => {
  const { app, revoked } = await fixture(); t.after(() => app.close());
  // Cover old tokens without jti and sessions issued by the current signer.
  for (const claims of [{ id: 7, username: 'test-admin' }, { id: 7, username: 'test-admin', jti: 'canonical-session' }]) {
    let token;
    for (let n = 0; n < 100; n++) {
      token = app.jwt.sign({ ...claims, nonce: n });
      if (/[-_]/.test(token.split('.')[2])) break;
    }
    const [header, payload, signature] = token.split('.');
    assert.match(signature, /[-_]/);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const alternateBits = signature.slice(0, -1) + alphabet[alphabet.indexOf(signature.at(-1)) + 1];
    const variants = [signature + '=', signature + '==', signature.replace(/-/g, '+').replace(/_/g, '/'), alternateBits, signature + '!'];
    assert.equal((await app.inject({ url: '/protected', headers: bearer(token) })).statusCode, 200);
    // The underlying verifier accepts all variants; the application must not.
    for (const variant of variants) {
      const changed = `${header}.${payload}.${variant}`;
      assert.equal(app.jwt.verify(changed).id, 7);
      assert.equal((await app.inject({ url: '/protected', headers: bearer(changed) })).statusCode, 401);
    }
    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: bearer(token) })).statusCode, 200);
    assert.ok(revoked.has(createHash('sha256').update(token).digest('hex')));
    for (const value of [signature, ...variants]) {
      assert.equal((await app.inject({ url: '/protected', headers: bearer(`${header}.${payload}.${value}`) })).statusCode, 401);
    }
  }
  const old = app.jwt.sign({ id: 7, username: 'test-admin', iat: Math.floor(Date.now() / 1000) - 60 });
  revoked.add(createHash('sha256').update(old).digest('hex'));
  assert.equal((await app.inject({ url: '/protected', headers: bearer(old) })).statusCode, 401);
  const separate = app.jwt.sign({ id: 7, username: 'test-admin', jti: 'still-signed-in' });
  assert.equal((await app.inject({ url: '/protected', headers: { authorization: `bEaReR ${separate}` } })).statusCode, 200);
});

test('missing, malformed, unsigned and expired tokens are rejected', async t => {
  const { app } = await fixture(); t.after(() => app.close());
  const bad = ['broken', 'eyJhbGciOiJub25lIn0.eyJpZCI6N30.', app.jwt.sign({ id: 7, username: 'test-admin' }, { expiresIn: -1 })];
  assert.equal((await app.inject('/protected')).statusCode, 401);
  for (const token of bad) assert.equal((await app.inject({ url: '/protected', headers: bearer(token) })).statusCode, 401);
});
test('password login rejects unknown user and wrong password; valid session verifies', async t => {
  const { app } = await fixture(); t.after(() => app.close());
  for (const payload of [{ username: 'missing', password: 'x' }, { username: 'test-admin', password: 'wrong' }]) {
    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', payload })).statusCode, 401);
  }
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'test-admin', password: 'correct-test-password' } });
  assert.equal(login.statusCode, 200);
  assert.equal((await app.inject({ url: '/api/auth/verify', headers: bearer(login.json().token) })).json().valid, true);
});
test('password login throttles repeated attempts', async t => {
  const { app } = await fixture(); t.after(() => app.close());
  for (let i = 0; i < 5; i++) assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'missing', password: 'x' } })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'missing', password: 'x' } })).statusCode, 429);
});
test('removed administrator and signed token without administrator identity are rejected', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  for (const payload of [{}, { id: 999, username: 'missing' }]) {
    assert.equal((await f.app.inject({ url: '/protected', headers: bearer(f.app.jwt.sign(payload)) })).statusCode, 401);
  }
  const token = f.app.jwt.sign({ id: 7, username: 'test-admin' });
  f.removeUser();
  assert.equal((await f.app.inject({ url: '/protected', headers: bearer(token) })).statusCode, 401);
});
test('logout revokes only that session, including a previously issued token without jti', async t => {
  const { app } = await fixture(); t.after(() => app.close());
  const token = app.jwt.sign({ id: 7, username: 'test-admin' });
  const other = app.jwt.sign({ id: 7, username: 'test-admin', jti: 'separate-session' });
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: bearer(token) })).statusCode, 200);
  assert.equal((await app.inject({ url: '/protected', headers: bearer(token) })).statusCode, 401);
  assert.equal((await app.inject({ url: '/protected', headers: bearer(other) })).statusCode, 200);
});
test('database failure fails closed but returns a retryable server error', async t => {
  const f = await fixture(); t.after(() => f.app.close());
  const token = f.app.jwt.sign({ id: 7, username: 'test-admin' }); f.failDb();
  assert.equal((await f.app.inject({ url: '/protected', headers: bearer(token) })).statusCode, 503);
});
test('Google verification checks audience, verified email and allowlist', async t => {
  const original = OAuth2Client.prototype.verifyIdToken;
  t.after(() => { OAuth2Client.prototype.verifyIdToken = original; });
  const { app } = await fixture(); t.after(() => app.close());
  for (const [payload, status] of [[{ email: 'allowed@example.test', email_verified: false }, 401], [{ email: 'outsider@example.test', email_verified: true }, 401], [{ email: 'ALLOWED@example.test', email_verified: true }, 200]]) {
    OAuth2Client.prototype.verifyIdToken = async ({ audience }) => { assert.equal(audience, 'auth-test-client'); return { getPayload: () => payload }; };
    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/google', payload: { credential: 'mock-verified-by-google-library' } })).statusCode, status);
  }
  OAuth2Client.prototype.verifyIdToken = async () => { throw new Error('bad signature or audience'); };
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/google', payload: { credential: 'invalid' } })).statusCode, 401);
});

test('two logins in the same second receive independent session IDs', async t => {
  const { app } = await fixture(); t.after(() => app.close());
  const tokens = [];
  for (let i = 0; i < 2; i++) {
    const result = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'test-admin', password: 'correct-test-password' } });
    assert.equal(result.statusCode, 200); tokens.push(result.json().token);
  }
  assert.notEqual(app.jwt.decode(tokens[0]).jti, app.jwt.decode(tokens[1]).jti);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: bearer(tokens[0]) })).statusCode, 200);
  assert.equal((await app.inject({ url: '/protected', headers: bearer(tokens[1]) })).statusCode, 200);
});

test('password and Google limits isolate clients across trusted prod/dev proxy chains', async t => {
  const original = OAuth2Client.prototype.verifyIdToken;
  t.after(() => { OAuth2Client.prototype.verifyIdToken = original; });
  OAuth2Client.prototype.verifyIdToken = async ({ idToken }) => {
    if (idToken !== 'allowed-fixture') throw new Error('invalid fixture credential');
    return { getPayload: () => ({ email: 'allowed@example.test', email_verified: true }) };
  };
  const proxy = createProxyTrust(['frontend', 'caddy'], {
    resolve: async name => name === 'frontend'
      ? [{ address: '172.25.0.19' }, { address: '172.25.0.13' }]
      : [{ address: '172.25.0.22' }],
  });
  await proxy.refresh();
  for (const remoteAddress of ['172.25.0.19', '::ffff:172.25.0.13']) {
    const { app } = await fixture({ trustProxy: proxy.trustProxy }); t.after(() => app.close());
    for (const [url, max, bad, good] of [
      ['/api/auth/login', 5, { username: 'missing', password: 'wrong' }, { username: 'test-admin', password: 'correct-test-password' }],
      ['/api/auth/google', 10, { credential: 'invalid-fixture' }, { credential: 'allowed-fixture' }],
    ]) {
      const attempt = (xff, payload) => app.inject({ method: 'POST', url, remoteAddress, headers: { 'x-forwarded-for': xff }, payload });
      for (let i = 0; i < max; i++) {
        // Rotating a forged leftmost address must not rotate the attacker's bucket.
        assert.equal((await attempt(`192.0.2.${i + 1}, 198.51.100.11, 172.25.0.22`, bad)).statusCode, 401);
      }
      assert.equal((await attempt('192.0.2.99, 198.51.100.11, 172.25.0.22', good)).statusCode, 429);
      const other = await attempt('203.0.113.22, 172.25.0.22', good);
      assert.equal(other.statusCode, 200);
      assert.equal((await app.inject({ url: '/protected', headers: bearer(other.json().token) })).statusCode, 200);
    }
  }
});

test('untrusted direct callers cannot rotate a login bucket with forwarded headers', async t => {
  const proxy = createProxyTrust(['frontend'], { resolve: async () => [{ address: '172.25.0.19' }] });
  await proxy.refresh();
  const { app } = await fixture({ trustProxy: proxy.trustProxy }); t.after(() => app.close());
  for (let i = 0; i < 6; i++) {
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', remoteAddress: '172.25.0.99',
      headers: { 'x-forwarded-for': `203.0.113.${i + 1}, 172.25.0.19`, 'x-real-ip': `192.0.2.${i + 1}` },
      payload: { username: 'missing', password: 'wrong' } });
    assert.equal(response.statusCode, i < 5 ? 401 : 429);
  }
});
