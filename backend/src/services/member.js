/**
 * 멤버 서비스
 * 멤버 관련 비즈니스 로직
 */
import { getOrSet, invalidate, cacheKeys } from '../utils/cache.js';

/**
 * 전체 멤버 목록 조회 (별명 포함, 캐시 적용)
 * @param {object} db - 데이터베이스 연결
 * @param {object} redis - Redis 클라이언트 (캐시용, 선택적)
 * @returns {array} 멤버 목록
 */
export async function getAllMembers(db, redis = null) {
  const fetchMembers = async () => {
    const [members] = await db.query(`
      SELECT
        m.id, m.name, m.name_en, m.birth_date, m.instagram, m.image_id, m.is_former,
        i.original_url as image_original,
        i.medium_url as image_medium,
        i.thumb_url as image_thumb
      FROM members m
      LEFT JOIN images i ON m.image_id = i.id
      ORDER BY m.is_former ASC, m.id ASC
    `);

    // 별명 조회
    const [nicknames] = await db.query(
      'SELECT member_id, nickname FROM member_nicknames'
    );

    // 멤버별 별명 매핑
    const nicknameMap = {};
    for (const n of nicknames) {
      if (!nicknameMap[n.member_id]) {
        nicknameMap[n.member_id] = [];
      }
      nicknameMap[n.member_id].push(n.nickname);
    }

    // 멤버 데이터에 별명 추가
    return members.map(m => ({
      ...m,
      nicknames: nicknameMap[m.id] || [],
      image_url: m.image_thumb || m.image_medium || m.image_original,
    }));
  };

  // Redis가 있으면 캐시 사용
  if (redis) {
    return getOrSet(redis, cacheKeys.members, fetchMembers, 600); // 10분 캐시
  }
  return fetchMembers();
}

/**
 * 멤버 캐시 무효화
 * @param {object} redis - Redis 클라이언트
 */
export async function invalidateMemberCache(redis) {
  await invalidate(redis, cacheKeys.members);
}

/**
 * 이름으로 멤버 조회 (별명 포함)
 * 한글명(name) 또는 영문명(name_en) 모두 검색 가능
 * @param {object} db - 데이터베이스 연결
 * @param {string} name - 멤버 이름 (한글 또는 영문)
 * @returns {object|null} 멤버 정보 또는 null
 */
export async function getMemberByName(db, name) {
  const [members] = await db.query(`
    SELECT
      m.id, m.name, m.name_en, m.birth_date, m.instagram, m.image_id, m.is_former,
      i.original_url as image_original,
      i.medium_url as image_medium,
      i.thumb_url as image_thumb
    FROM members m
    LEFT JOIN images i ON m.image_id = i.id
    WHERE m.name = ? OR LOWER(m.name_en) = LOWER(?)
  `, [name, name]);

  if (members.length === 0) {
    return null;
  }

  const member = members[0];

  // 별명 조회
  const [nicknames] = await db.query(
    'SELECT nickname FROM member_nicknames WHERE member_id = ?',
    [member.id]
  );

  return {
    ...member,
    nicknames: nicknames.map(n => n.nickname),
    image_url: member.image_original || member.image_medium || member.image_thumb,
  };
}

/**
 * ID로 멤버 기본 정보 조회 (수정용)
 * @param {object} db - 데이터베이스 연결
 * @param {string} name - 멤버 이름
 * @returns {object|null} 멤버 기본 정보 또는 null
 */
export async function getMemberBasicByName(db, name) {
  const [members] = await db.query(
    'SELECT id, image_id FROM members WHERE name = ?',
    [name]
  );
  return members.length > 0 ? members[0] : null;
}
