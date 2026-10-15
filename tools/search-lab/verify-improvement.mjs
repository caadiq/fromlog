// Lab-only verification of the application search implementation; no production writes.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const { MeiliSearch } = require('meilisearch');
import { searchSchedules, syncAllSchedules } from '../../backend/src/services/meilisearch/index.js';
const snapshot = JSON.parse(fs.readFileSync(process.argv[2]));
const cases = JSON.parse(fs.readFileSync(new URL('./cases.json', import.meta.url)));
const client = new MeiliSearch({ host: 'http://fromlog-search-lab-meilisearch:7700' });
try { await client.getIndex('lab-improved'); } catch (error) {
  if (error.code !== 'index_not_found') throw error;
  await client.waitForTask((await client.createIndex('lab-improved', { primaryKey: 'id' })).taskUid);
}
const index = client.index('lab-improved');
const task = await index.updateSettings({ searchableAttributes: ['title','title_compact','source_name','broadcaster','description','category_name'], filterableAttributes: ['category_id','date'], sortableAttributes: ['date','time'], rankingRules: ['words','typo','proximity','attribute','exactness','date:desc'], typoTolerance: { enabled:true, disableOnNumbers:true,minWordSizeForTypos:{oneTypo:2,twoTypos:4}},pagination:{maxTotalHits:10000} });
await client.waitForTask(task.taskUid);
const extras = new Map(snapshot.extras.map(e => [e.id,e]));
const rows = snapshot.documents.map(d => ({ ...d, ...extras.get(d.id), source_name: d.source_name || extras.get(d.id)?.broadcaster || '' }));
let hydrateCount = 0;
const db = { query: async (sql,args=[]) => {
 if(sql.includes('SELECT `value`'))return [[]];
 if(sql.includes('SELECT DISTINCT school_name'))return [snapshot.schools.map(s=>({school_name:s}))];
 if(sql.startsWith('SELECT id FROM schedules'))return [rows.filter(r=>args.includes(r.id)).map(r=>({id:r.id}))];
 if(sql.includes('WHERE s.id IN')){hydrateCount+=args.length;return [rows.filter(r=>args.includes(r.id))];}
 return [rows];
}};
const meili = {index:()=>index, waitForTask: (...args)=>client.waitForTask(...args)};
await syncAllSchedules(meili,db);
const results=[];
for(const c of cases){
 const start=performance.now();
 const result=await searchSchedules(meili,db,c.q,{limit:10000});
 let hits=result.hits;
 if(c.category)hits=hits.filter(h=>h.category.name===c.category);
 if(c.from)hits=hits.filter(h=>h.date>=c.from);
 if(c.to)hits=hits.filter(h=>h.date<=c.to);
 results.push({case:c,ids:hits.map(h=>h.id),ms:performance.now()-start});
}
hydrateCount=0;
const page=await searchSchedules(meili,db,'프로미스나인',{limit:20});
fs.writeFileSync(process.argv[3],JSON.stringify({results,pageCheck:{total:page.total,hydrated:hydrateCount,returned:page.hits.length}},null,2));
console.log('Compared',results.length,'queries; page check',page.total,hydrateCount);
