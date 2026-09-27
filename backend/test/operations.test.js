import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import Fastify from 'fastify';
import mysql from 'mysql2/promise';
import Redis from 'ioredis';
import { getOrSet } from '../src/utils/cache.js';
import readiness from '../src/plugins/readiness.js';
import redisPlugin from '../src/plugins/redis.js';
import meiliPlugin from '../src/plugins/meilisearch.js';
import { createOpsAlerts } from '../src/services/opsAlerts.js';
import { installShutdown } from '../src/utils/shutdown.js';
import { withDeadline } from '../src/utils/deadline.js';
import { fetchVideoInfo } from '../src/services/youtube/api.js';
import { fetchTweets } from '../src/services/x/scraper.js';
const quiet = {info(){},warn(){},error(){}};

test('cache read/write failures and corrupt entries preserve DB result, DB error still propagates',async()=>{
 for(const cached of [new Error('offline'),'bad json',null]){
  let calls=0;const redis={get:async()=>{if(cached instanceof Error)throw cached;return cached;},set:async()=>{throw Error('offline');}};
  assert.deepEqual(await getOrSet(redis,'key',async()=>{calls++;return [1];}),[1]);assert.equal(calls,1);
  await assert.rejects(getOrSet(redis,'key',async()=>{throw Error('DB failed');}),/DB failed/);
 }
});
test('readiness reports dependency outage, coalesces probes and bounds hung probes',async()=>{
 const app=Fastify();let count=0;app.decorate('db',{query:async()=>{count++;return [[1]];}});app.decorate('redis',{ping:async()=>{throw Error('offline');}});app.decorate('meilisearch',{health:()=>new Promise(()=>{})});await app.register(readiness,{timeoutMs:30});
 const responses=await Promise.all(Array.from({length:8},()=>app.inject('/api/ready')));assert.equal(count,1);for(const r of responses){assert.equal(r.statusCode,503);assert.deepEqual(r.json(),{status:'degraded',checks:{database:'ok',redis:'unavailable',search:'unavailable'}});}await app.close();
});
test('healthy readiness returns success without internal connection details',async()=>{
 const app=Fastify();app.decorate('db',{query:async()=>[[1]]});app.decorate('redis',{ping:async()=>'PONG'});app.decorate('meilisearch',{health:async()=>({status:'available'})});await app.register(readiness);const r=await app.inject('/api/ready');assert.equal(r.statusCode,200);assert.equal(r.json().status,'ok');await app.close();
});
test('shutdown handles duplicate signals once and bounds stalled close',async()=>{
 const target=new EventEmitter(),codes=[];let closes=0;const cleanup=installShutdown({log:quiet,close:async()=>{closes++;}},{target,exit:code=>codes.push(code),timeoutMs:30});target.emit('SIGTERM');target.emit('SIGINT');await new Promise(setImmediate);assert.equal(closes,1);assert.deepEqual(codes,[0]);cleanup();
 const target2=new EventEmitter();const cleanup2=installShutdown({log:quiet,close:()=>new Promise(()=>{})},{target:target2,exit:code=>codes.push(code),timeoutMs:20});target2.emit('SIGTERM');await new Promise(r=>setTimeout(r,40));assert.deepEqual(codes,[0,1]);cleanup2();
});
test('deadline consumes late failures',async()=>{await assert.rejects(withDeadline(()=>new Promise((_,r)=>setTimeout(()=>r(Error('late')),40)),10),/timed out/);await new Promise(r=>setTimeout(r,50));});
test('YouTube slow response body is covered by timeout',async t=>{
 const original=AbortSignal.timeout;t.mock.method(AbortSignal,'timeout',()=>original(20));
 t.mock.method(globalThis,'fetch',async(url,{signal})=>({json:()=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))}));
 const keepAlive=setTimeout(()=>{},100);try{await assert.rejects(fetchVideoInfo('abcdefghijk'),/timeout/i);}finally{clearTimeout(keepAlive);}
});
test('Redis plugin degrades at startup, reconnects, and real stalled cache falls back',{skip:process.env.OPS_AUDIT_DB !== '1'},async()=>{
 const app=Fastify();app.decorate('config',{redis:{host:'127.0.0.1',port:6379}});await app.register(redisPlugin);await app.ready();await app.redis.set('ops-test-cache','not-json');assert.equal(await getOrSet(app.redis,'ops-test-cache',async()=>7),7);
 const control=new Redis({host:'127.0.0.1',port:6379});await control.call('CLIENT','PAUSE',2600,'ALL');const start=Date.now();assert.equal(await getOrSet(app.redis,'ops-hang',async()=>9),9);assert.ok(Date.now()-start<5000);assert.equal(await app.redis.ping(),'PONG');control.disconnect();await app.close();
 const offline=Fastify();offline.decorate('config',{redis:{host:'127.0.0.1',port:6399}});await offline.register(redisPlugin);await offline.ready();assert.equal(await getOrSet(offline.redis,'none',async()=>12),12);await offline.close();
});
test('durable stop alerts retry after restart, skipped/partial delivery stays pending, single-flight sends',{skip:process.env.OPS_AUDIT_DB !== '1'},async()=>{
 const db=mysql.createPool({host:'127.0.0.1',user:'root',database:'ops_test'});await db.query('DELETE FROM bot_ops_alerts');let calls=0;const payload={title:'stop',body:'test',data:{botId:'youtube-1'}};
 const failed=createOpsAlerts(db,quiet,async()=>{calls++;throw Error('offline');});await failed.enqueue(payload);await failed.flush();let [rows]=await db.query('SELECT * FROM bot_ops_alerts');assert.equal(rows.length,1);assert.equal(rows[0].attempts,1);
 for(const result of [{skipped:true,sent:0,failed:0},{sent:1,failed:1}]){await db.query('UPDATE bot_ops_alerts SET next_attempt_at=NOW()');await createOpsAlerts(db,quiet,async()=>result).flush();assert.equal((await db.query('SELECT * FROM bot_ops_alerts'))[0].length,1);}
 await db.query('UPDATE bot_ops_alerts SET next_attempt_at=NOW()');let deliveries=0;const restarted=createOpsAlerts(db,quiet,async()=>{deliveries++;await new Promise(r=>setTimeout(r,25));return {sent:1,failed:0};});await Promise.all([restarted.flush(),restarted.flush()]);assert.equal(deliveries,1);assert.equal((await db.query('SELECT * FROM bot_ops_alerts'))[0].length,0);await db.end();
});
test('hung alert sender leaves retryable durable record',{skip:process.env.OPS_AUDIT_DB !== '1'},async()=>{
 const db=mysql.createPool({host:'127.0.0.1',user:'root',database:'ops_test'});await db.query('DELETE FROM bot_ops_alerts');const outbox=createOpsAlerts(db,quiet,()=>new Promise(()=>{}),{timeoutMs:20});await outbox.enqueue({title:'test',data:{botId:'x-1'}});await outbox.flush();const [rows]=await db.query('SELECT attempts FROM bot_ops_alerts');assert.equal(rows[0].attempts,1);await db.end();
});

test('X slow response body is covered by timeout',async t=>{
 const original=AbortSignal.timeout;t.mock.method(AbortSignal,'timeout',()=>original(20));
 t.mock.method(globalThis,'fetch',async(url,{signal})=>({ok:true,text:()=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))}));
 const keepAlive=setTimeout(()=>{},100);try{await assert.rejects(fetchTweets('http://127.0.0.1','test'),/timeout/i);}finally{clearTimeout(keepAlive);}
});

test('Meilisearch timeout covers stalled bodies with a fresh signal per request',async t=>{
 const original=AbortSignal.timeout;t.mock.method(AbortSignal,'timeout',()=>original(20));const signals=[];
 t.mock.method(globalThis,'fetch',async(url,{signal})=>{signals.push(signal);return new Response(new ReadableStream({start(c){signal.addEventListener('abort',()=>c.error(signal.reason),{once:true});}}));});
 const app={config:{meilisearch:{host:'http://127.0.0.1:7700'}},log:quiet,decorate(k,v){this[k]=v;}};
 const keepAlive=setTimeout(()=>{},200);try{await meiliPlugin(app,{});await assert.rejects(app.meilisearch.health(),/timeout/i);assert.equal(signals.length,2);assert.notEqual(signals[0],signals[1]);}finally{clearTimeout(keepAlive);}
});

test('manual recovery cancels stale pending stop alerts', {skip:process.env.OPS_AUDIT_DB !== '1'},async()=>{
 const db=mysql.createPool({host:'127.0.0.1',user:'root',database:'ops_test'});await db.query('DELETE FROM bot_ops_alerts');const outbox=createOpsAlerts(db,quiet,async()=>({skipped:true}));await outbox.enqueue({title:'test',data:{botId:'youtube-1'}});await outbox.flush();await outbox.cancel('youtube-1');assert.equal((await db.query('SELECT * FROM bot_ops_alerts'))[0].length,0);await db.end();
});
