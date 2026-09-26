// Leave pool connections available for work while advisory locks are held.
const waiters = [];
let active = 0;
async function takeSlot() {
  if (active >= 3) await new Promise(resolve => waiters.push(resolve));
  else active++;
}
function releaseSlot() {
  const next = waiters.shift();
  if (next) next(); else active--;
}
// Serialize ingestion of the same resource across processes.
export async function withIngestionLock(db, key, work) {
  await takeSlot();
  let conn;
  try { conn = await db.getConnection(); } catch (err) { releaseSlot(); throw err; }
  let locked = false;
  try {
    const [rows] = await conn.query('SELECT GET_LOCK(?, 30) AS acquired', [key]);
    locked = rows[0]?.acquired === 1;
    if (!locked) throw new Error('Ingestion resource is busy; retry on next poll');
    return await work();
  } finally {
    try { if (locked) await conn.query('SELECT RELEASE_LOCK(?)', [key]); }
    finally { conn.release(); releaseSlot(); }
  }
}

export const withYoutubeChannelLock = (db, channelId, work) => withIngestionLock(db, `yt:${channelId}`, work);
