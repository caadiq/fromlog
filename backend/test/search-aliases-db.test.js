import { test } from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { getAliases, saveAliases } from '../src/services/searchAliases.js';

test('isolated MariaDB: concurrent first insert/update, case-sensitive revision, persistence', { skip: process.env.ALIAS_TEST_DB !== 'alias_test' }, async () => {
  const db = mysql.createPool({ host: '127.0.0.1', user: 'root', database: 'alias_test', connectionLimit: 4 });
  try {
    await db.query('CREATE TABLE IF NOT EXISTS app_settings (`key` VARCHAR(64) PRIMARY KEY, `value` TEXT)');
    await db.query('CREATE TABLE IF NOT EXISTS schedule_event (school_name VARCHAR(255))');
    await db.query("DELETE FROM app_settings WHERE `key` = 'schedule_search_aliases'");
    const initial = await getAliases(db);
    const payload = name => ({ groups: [{ canonical: name, aliases: ['테스트별칭'] }], disabledSchools: [], revision: initial.revision });
    const saves = await Promise.allSettled([saveAliases(db, payload('첫번째이름')), saveAliases(db, payload('두번째이름'))]);
    assert.equal(saves.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(saves.find(r => r.status === 'rejected').reason.statusCode, 409);
    const persisted = await getAliases(db);
    const result = await saveAliases(db, { groups: [{ canonical: '검증이름', aliases: ['UPPER'] }], disabledSchools: ['호서대학교'], revision: persisted.revision });
    await saveAliases(db, { ...result, groups: [{ canonical: '검증이름', aliases: ['upper'] }] });
    assert.equal((await getAliases(db)).groups[0].aliases[0], 'upper');
    await assert.rejects(saveAliases(db, { ...result, groups: [] }), { statusCode: 409 });
    assert.deepEqual((await getAliases(db)).disabledSchools, ['호서대학교']);
  } finally { await db.end(); }
});
