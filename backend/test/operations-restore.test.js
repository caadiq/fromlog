import assert from 'node:assert/strict';
import { test } from 'node:test';
import mysql from 'mysql2/promise';
import { buildApp } from '../src/app.js';

test('restored DB serves public pages with Redis and search offline', { skip: process.env.OPS_RESTORE_DB !== '1' }, async()=>{
 const app=await buildApp({logger:false});
 try {
  assert.equal((await app.inject('/api/health')).statusCode,200);
  const ready=await app.inject('/api/ready');assert.equal(ready.statusCode,503);assert.equal(ready.json().checks.database,'ok');assert.equal(ready.json().checks.redis,'unavailable');
  for(const url of ['/api/members','/api/schedules/categories','/api/schedules?year=2026&month=9'])assert.equal((await app.inject(url)).statusCode,200,url);
 } finally {await app.close();}
});
test('restored foreign keys have no orphaned rows', { skip: process.env.OPS_RESTORE_DB !== '1' }, async()=>{
 const db=await mysql.createConnection({host:'127.0.0.1',user:'root',database:'fromlog'});
 try {
  const [keys]=await db.query("SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME,CONSTRAINT_NAME,ORDINAL_POSITION FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='fromlog' AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION");
  const groups=Map.groupBy?Map.groupBy(keys,k=>k.TABLE_NAME+':'+k.CONSTRAINT_NAME):keys.reduce((m,k)=>{const id=k.TABLE_NAME+':'+k.CONSTRAINT_NAME;m.set(id,[...(m.get(id)||[]),k]);return m;},new Map());
  const id=value=>'`'+value.replaceAll('`','``')+'`';
  for(const cols of groups.values()){
   const k=cols[0],join=cols.map(c=>`c.${id(c.COLUMN_NAME)}=p.${id(c.REFERENCED_COLUMN_NAME)}`).join(' AND '),nonNull=cols.map(c=>`c.${id(c.COLUMN_NAME)} IS NOT NULL`).join(' AND ');
   const [[row]]=await db.query(`SELECT COUNT(*) AS n FROM ${id(k.TABLE_NAME)} c LEFT JOIN ${id(k.REFERENCED_TABLE_NAME)} p ON ${join} WHERE ${nonNull} AND p.${id(k.REFERENCED_COLUMN_NAME)} IS NULL`);assert.equal(row.n,0,k.TABLE_NAME+':'+k.CONSTRAINT_NAME);
  }
  console.log('Restored FK constraints checked:',groups.size);
 }finally{await db.end();}
});
