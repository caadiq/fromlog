import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
const c = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, multipleStatements: true });
await c.query(readFileSync('/tmp/mig.sql', 'utf8'));
const [cols] = await c.query('SHOW COLUMNS FROM schedule_ticketing');
console.log('생성 완료:', cols.map(x=>x.Field).join(', '));
await c.end();
