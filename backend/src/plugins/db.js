import fp from 'fastify-plugin';
import mysql from 'mysql2/promise';

async function dbPlugin(fastify, opts) {
  const pool = mysql.createPool(fastify.config.db);

  // 연결 테스트
  try {
    const conn = await pool.getConnection();
    fastify.log.info('MariaDB 연결 성공');
    conn.release();
  } catch (err) {
    fastify.log.error('MariaDB 연결 실패:', err.message);
    throw err;
  }

  fastify.decorate('db', pool);

  fastify.addHook('onClose', async () => {
    await pool.end();
    fastify.log.info('MariaDB 연결 종료');
  });
}

export default fp(dbPlugin, { name: 'db' });
