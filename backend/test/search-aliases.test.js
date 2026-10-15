import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { validateAliases, schoolAliases, expandAliases, getAliases, saveAliases } from '../src/services/searchAliases.js';
import { searchSchedules } from '../src/services/meilisearch/search.js';
import routes from '../src/routes/schedules/search-aliases.js';

const groups = [{ canonical: '프로미스나인', aliases: ['프나', 'fromis_9'] }, { canonical: '건국대학교', aliases: ['건대'] }];
const setup = { groups, disabledSchools: [] };
function dbFixture() {
  let stored = null;
  const calls = [];
  return { calls, query: async (sql, args = []) => {
    calls.push({ sql, args });
    if (sql.includes('SELECT `value`')) return [stored === null ? [] : [{ value: stored }]];
    if (sql.includes('SELECT DISTINCT school_name')) return [[{ school_name: '호서대학교 아산캠퍼스' }, { school_name: '호서대학교 천안캠퍼스' }]];
    if (sql.startsWith('INSERT INTO app_settings')) { if (stored !== null) throw Object.assign(Error('duplicate'), { code: 'ER_DUP_ENTRY' }); stored = args[1]; return [{ affectedRows: 1 }]; }
    if (sql.startsWith('UPDATE app_settings')) { if (stored !== args[2]) return [{ affectedRows: 0 }]; stored = args[0]; return [{ affectedRows: 1 }]; }
    return [[]];
  } };
}
test('aliases validate duplicates, canonical collisions, empty and oversized names', () => {
  assert.deepEqual(validateAliases(setup), setup);
  for (const value of [
    { ...setup, groups: [{ canonical: '건국대학교', aliases: ['건 국 대학교'] }] },
    { ...setup, groups: [{ canonical: '가나다', aliases: ['가나'] }, { canonical: '가나', aliases: ['다라'] }] },
    { ...setup, groups: [{ canonical: '가나다', aliases: [] }] },
    { ...setup, groups: [{ canonical: '가나다', aliases: ['a'.repeat(81)] }] },
  ]) assert.throws(() => validateAliases(value));
});
test('automatic school aliases preserve campuses, manual precedence, and disabling', () => {
  const schools = ['호서대학교 아산캠퍼스', '호서대학교 천안캠퍼스', '카이스트(KAIST)'];
  assert.deepEqual(schoolAliases(schools, setup), [{ canonical: '호서대학교', aliases: ['호서대'], enabled: true }]);
  assert.equal(schoolAliases(schools, { ...setup, disabledSchools: ['호서대학교'] })[0].enabled, false);
  assert.equal(schoolAliases(schools, { ...setup, groups: [{ canonical: '다른이름', aliases: ['호서대'] }] }).length, 0);
});
test('alias expansion is bounded, one-way, and does not rewrite ordinary substrings', () => {
  const config = { ...setup, automatic: schoolAliases(['호서대학교 아산캠퍼스'], setup) };
  assert.ok(expandAliases('프나 호서대', config).includes('프로미스나인 호서대학교'));
  assert.deepEqual(expandAliases('프나', config), ['프로미스나인']);
  assert.deepEqual(expandAliases('건대입구 지원금', config), []);
  assert.deepEqual(expandAliases('지원', config), []);
  assert.deepEqual(expandAliases('프로미스나인', config), []);
});
test('settings persist and stale concurrent saves cannot overwrite a newer revision', async () => {
  const db = dbFixture(), before = await getAliases(db);
  const saved = await saveAliases(db, { ...setup, revision: before.revision });
  assert.equal((await getAliases(db)).revision, saved.revision);
  await assert.rejects(saveAliases(db, { ...setup, groups: [], revision: before.revision }), { statusCode: 409 });
  await saveAliases(db, { ...setup, groups: [], revision: saved.revision });
  assert.deepEqual((await getAliases(db)).groups, []);
});
test('admin routes protect reads and writes and log successful edits', async t => {
  const app = Fastify(); t.after(() => app.close());
  const db = dbFixture(); app.decorate('db', db);
  app.decorate('authenticate', async (request, reply) => { if (request.headers.authorization !== 'test-admin') return reply.code(401).send({ error: 'unauthorized' }); });
  await app.register(routes);
  assert.equal((await app.inject('/aliases')).statusCode, 401);
  assert.equal((await app.inject({ method: 'PUT', url: '/aliases', payload: { ...setup, revision: '0'.repeat(64) } })).statusCode, 401);
  const headers = { authorization: 'test-admin' };
  const initial = (await app.inject({ url: '/aliases', headers })).json();
  assert.equal((await app.inject({ method: 'PUT', url: '/aliases', headers, payload: { ...setup, revision: initial.revision } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'PUT', url: '/aliases', headers, payload: { ...setup, revision: initial.revision } })).statusCode, 409);
  assert.ok(db.calls.some(c => c.sql.includes('INSERT INTO logs')));
});
test('exact program episodes rank newest before X mentions; DB hydration is limited to the requested page', async () => {
  const db = dbFixture(), baseQuery = db.query;
  const hits = [
    { id: 1, title: '[알림] 계약결혼', date: '2026-10-20', _rankingScore: 1 },
    { id: 2, title: '계약결혼 1회', date: '2026-10-01', _rankingScore: .9 },
    { id: 3, title: '계약결혼 3회', date: '2026-10-15', _rankingScore: .8 },
    { id: 4, title: '계약결혼 4회', date: '2026-10-22', _rankingScore: .8 },
  ];
  const hydration = [];
  db.query = async (sql, args) => {
    if (sql.startsWith('SELECT id FROM schedules')) return [hits.filter(h => args.includes(h.id) && h.id !== 4)];
    if (sql.includes('WHERE s.id IN')) { hydration.push(args); return [hits.filter(h => args.includes(h.id)).map(h => ({ ...h, category_id: 10, time: null }))]; }
    return baseQuery(sql, args);
  };
  const calls = [], meili = { index: () => ({ search: async (q, opts) => { calls.push({ q, opts }); return { hits }; } }) };
  const result = await searchSchedules(meili, db, '계약결혼', { offset: 0, limit: 1 });
  assert.equal(result.total, 3); assert.deepEqual(result.hits.map(h => h.id), [3]); assert.equal(result.hasMore, true);
  assert.deepEqual(hydration, [[3]]);
  assert.equal(calls[0].opts.matchingStrategy, 'all');
  assert.ok(!calls[0].opts.attributesToRetrieve.includes('*'));
});
test('multi-word no-results never drops a condition; English keyboard only retries after no match', async () => {
  const calls = [], db = dbFixture();
  const meili = { index: () => ({ search: async (q, opts) => { calls.push([q, opts.matchingStrategy]); return { hits: [] }; } }) };
  await searchSchedules(meili, db, '서울대학교 POLARIS');
  assert.ok(calls.every(c => c[1] === 'all'));
  calls.length = 0;
  await searchSchedules(meili, db, 'dnjzmehf');
  assert.ok(calls.some(c => c[0] === '워크돌'));
});

test('single-word typo recovery runs even when weak metadata hits exist; requested episode rejects different numbered titles', async () => {
  const db = dbFixture(), baseQuery = db.query, calls = [];
  const rows = [
    { id: 1, title: '관련된 글', date: '2026-10-10', category_id: 1, _rankingScore: .7 },
    { id: 2, title: '뮤지컬 헬스키친', date: '2026-10-11', category_id: 1, _rankingScore: .9 },
    { id: 3, title: '계약결혼 2회', date: '2026-10-12', category_id: 10, _rankingScore: 1 },
    { id: 4, title: '계약결혼 3회', date: '2026-10-19', category_id: 10, _rankingScore: 1 },
  ];
  db.query = async (sql, args) => sql.includes('WHERE id IN') || sql.includes('WHERE s.id IN') ? [rows.filter(r => args.includes(r.id))] : baseQuery(sql, args);
  const meili = { index: () => ({ search: async (q, opts) => {
    calls.push(opts);
    return { hits: q.includes('계약') ? rows.slice(2) : opts.attributesToSearchOn ? [rows[1]] : [rows[0]] };
  } }) };
  const typo = await searchSchedules(meili, db, '헬스키찬');
  assert.ok(typo.hits.some(r => r.id === 2));
  assert.ok(calls.some(c => c.attributesToSearchOn));
  const episode = await searchSchedules(meili, db, '계약결혼 2회');
  assert.deepEqual(episode.hits.map(r => r.id), [3]);
});

test('full and incremental indexing preserve description, broadcaster, normalized title and compact title', async () => {
  const { syncAllSchedules, syncScheduleById } = await import('../src/services/meilisearch/index.js');
  const documents = [], row = { id: 1, title: '아는 형님', broadcaster: 'JTBC', description: '박지원 출연', source_name: 'JTBC', date: '2026-10-03', category_id: 10 };
  const db = { query: async sql => { assert.ok(sql.includes('sv.broadcaster') && sql.includes('sx.content')); return [[row]]; } };
  const meili = { index: () => ({ getDocuments: async () => ({ results: [] }), addDocuments: async docs => { documents.push(docs); return { taskUid: 1 }; } }), waitForTask: async () => ({ status: 'succeeded' }) };
  await syncAllSchedules(meili, db); await syncScheduleById(meili, db, 1);
  assert.deepEqual(documents[0], documents[1]);
  assert.equal(documents[0][0].title_compact, '아는형님');
  assert.equal(documents[0][0].description, '박지원 출연');
  assert.equal(documents[0][0].broadcaster, 'JTBC');
});
