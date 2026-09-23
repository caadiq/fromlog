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
// Serialize X and YouTube bot writes for one channel across processes.
export async function withYoutubeChannelLock(db, channelId, work) {
  await takeSlot();
  let conn;
  try { conn = await db.getConnection(); } catch (err) { releaseSlot(); throw err; }
  const key = `yt:${channelId}`;
  let locked = false;
  try {
    const [rows] = await conn.query('SELECT GET_LOCK(?, 30) AS acquired', [key]);
    locked = rows[0]?.acquired === 1;
    if (!locked) throw new Error('YouTube channel is busy; retry on next poll');
    return await work();
  } finally {
    try { if (locked) await conn.query('SELECT RELEASE_LOCK(?)', [key]); }
    finally { conn.release(); releaseSlot(); }
  }
}
