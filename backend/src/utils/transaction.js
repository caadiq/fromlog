/**
 * 트랜잭션 헬퍼 유틸리티
 * 반복되는 트랜잭션 패턴 추상화
 */

/**
 * 트랜잭션 래퍼 함수
 * @param {object} db - 데이터베이스 연결 풀
 * @param {function} callback - 트랜잭션 내에서 실행할 함수 (connection을 인자로 받음)
 * @returns {Promise<any>} callback의 반환값
 * @throws callback에서 발생한 에러 (자동 롤백 후 재throw)
 *
 * @example
 * const result = await withTransaction(db, async (connection) => {
 *   await connection.query('INSERT INTO ...');
 *   await connection.query('UPDATE ...');
 *   return { success: true };
 * });
 */
export async function withTransaction(db, callback) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
