/**
 * Redis 캐시 유틸리티
 */

// 기본 TTL (초 단위)
const DEFAULT_TTL = 300; // 5분

/**
 * 캐시에서 값을 가져오거나 없으면 함수 실행 후 캐시
 * @param {object} redis - Redis 클라이언트
 * @param {string} key - 캐시 키
 * @param {Function} fn - 데이터 조회 함수
 * @param {number} ttl - TTL (초), 기본 5분
 * @returns {Promise<any>} 캐시된 값 또는 새로 조회한 값
 */
export async function getOrSet(redis, key, fn, ttl = DEFAULT_TTL) {
  // 캐시 조회
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  // 캐시 미스: 데이터 조회 후 캐싱
  const data = await fn();
  if (data !== null && data !== undefined) {
    await redis.set(key, JSON.stringify(data), 'EX', ttl);
  }
  return data;
}

/**
 * 캐시 무효화
 * @param {object} redis - Redis 클라이언트
 * @param {string|string[]} keys - 캐시 키 또는 키 배열
 */
export async function invalidate(redis, keys) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  if (keyList.length > 0) {
    await redis.del(...keyList);
  }
}

/**
 * 패턴으로 캐시 무효화 (SCAN 사용으로 블로킹 방지)
 * @param {object} redis - Redis 클라이언트
 * @param {string} pattern - 키 패턴 (예: 'schedule:*')
 */
export async function invalidatePattern(redis, pattern) {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}

// 캐시 키 생성 헬퍼
export const cacheKeys = {
  // 멤버
  members: 'members:all',
  member: (name) => `member:${name}`,
  // 일정
  categories: 'categories:all',
  scheduleDetail: (id) => `schedule:${id}`,
  scheduleMonthly: (year, month) => `schedule:monthly:${year}:${month}`,
  // 앨범
  albums: 'albums:all',
  albumDetail: (id) => `album:${id}`,
  albumByName: (name) => `album:name:${name}`,
};

// TTL 상수 (초)
export const TTL = {
  SHORT: 60,        // 1분
  MEDIUM: 300,      // 5분
  LONG: 600,        // 10분
  VERY_LONG: 3600,  // 1시간
};
