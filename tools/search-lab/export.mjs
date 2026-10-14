// Run via stdin inside the backend container; stdout contains public schedule data only.
import mysql from 'mysql2/promise';
import config from './src/config/index.js';
const db = mysql.createPool(config.db);
const headers = { Authorization: `Bearer ${config.meilisearch.apiKey}` };
async function meili(path) {
  const res = await fetch(config.meilisearch.host + path, { headers });
  if (!res.ok) throw new Error(`Meilisearch HTTP ${res.status}`);
  return res.json();
}
try {
  const version = await meili('/version');
  const settings = await meili('/indexes/schedules/settings');
  const documents = [];
  for (let offset = 0; ; offset += 1000) {
    const { results } = await meili(`/indexes/schedules/documents?offset=${offset}&limit=1000`);
    documents.push(...results); if (results.length < 1000) break;
  }
  const [extras] = await db.query(`SELECT s.id,
    CONCAT_WS(' ', v.description, e.description, etc.description, x.content) AS description,
    v.broadcaster, e.school_name
    FROM schedules s
    LEFT JOIN schedule_variety v ON v.schedule_id = s.id
    LEFT JOIN schedule_event e ON e.schedule_id = s.id
    LEFT JOIN schedule_etc etc ON etc.schedule_id = s.id
    LEFT JOIN schedule_x x ON x.schedule_id = s.id`);
  const [schools] = await db.query('SELECT DISTINCT school_name FROM schedule_event WHERE school_name IS NOT NULL');
  console.log(JSON.stringify({ capturedAt: new Date().toISOString(), version, settings, documents, extras, schools: schools.map(s => s.school_name), minScore: config.meilisearch.minScore }));
} finally { await db.end(); }
