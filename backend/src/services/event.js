/**
 * 행사(이벤트) 공통 서비스
 * - 관리자 라우트(events.js)와 축제 크롤러 봇(festival)이 공유
 */
import { CATEGORY_IDS } from '../config/index.js';
import { withTransaction } from '../utils/transaction.js';
import { syncScheduleById } from './meilisearch/index.js';

const EVENT_CATEGORY_ID = CATEGORY_IDS.EVENT;
const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY;

/**
 * 장소를 upsert (kakao_id 기준) 후 venue_id 반환
 * @param {object} conn - DB 연결 (트랜잭션 conn 또는 pool)
 * @param {object} venue - 장소 정보
 */
export async function upsertVenue(conn, venue) {
  if (!venue) return null;
  if (venue.id) return venue.id;
  if (!venue.name) return null;

  const kakaoId = venue.kakao_id || venue.kakaoId || null;

  // kakao_id가 있으면 먼저 조회
  if (kakaoId) {
    const [rows] = await conn.query('SELECT id FROM event_venues WHERE kakao_id = ?', [kakaoId]);
    if (rows.length > 0) return rows[0].id;
  }

  const [result] = await conn.query(
    `INSERT INTO event_venues (name, address, road_address, lat, lng, kakao_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      venue.name,
      venue.address || null,
      venue.road_address || venue.roadAddress || null,
      venue.lat ?? null,
      venue.lng ?? null,
      kakaoId,
    ]
  );
  return result.insertId;
}

/**
 * 행사 일정 생성 (schedules + schedule_event)
 * 포스터는 호출 측에서 별도 처리 (S3 업로드 후 poster_image_ids UPDATE)
 *
 * @param {object} db - DB pool
 * @param {object} meilisearch - Meilisearch 클라이언트
 * @param {object} data - { title, date, time, subtype, schoolName, venue, postUrls }
 * @returns {Promise<number>} 생성된 schedule_id
 */
export async function createEventSchedule(db, meilisearch, data) {
  const {
    title, date, time, subtype = 'university', schoolName,
    venue, postUrls = [],
  } = data;

  const scheduleId = await withTransaction(db, async (conn) => {
    // 1) venue upsert
    const venueId = await upsertVenue(conn, venue);

    // 2) schedules INSERT
    const [sResult] = await conn.query(
      `INSERT INTO schedules (category_id, title, date, time) VALUES (?, ?, ?, ?)`,
      [EVENT_CATEGORY_ID, title, date, time || null]
    );
    const sid = sResult.insertId;

    // 3) schedule_event INSERT
    await conn.query(
      `INSERT INTO schedule_event (schedule_id, subtype, school_name, venue_id, post_urls)
       VALUES (?, ?, ?, ?, ?)`,
      [
        sid,
        subtype,
        schoolName,
        venueId,
        postUrls.length > 0 ? JSON.stringify(postUrls) : null,
      ]
    );

    return sid;
  });

  // Meilisearch 동기화 (트랜잭션 외부)
  await syncScheduleById(meilisearch, db, scheduleId);

  return scheduleId;
}

/**
 * 기타(공용) 일정 생성 — schedules(카테고리 1) + schedule_etc + Meili 동기화
 * @param {object} db
 * @param {object} meilisearch
 * @param {object} data - { title, date, time, description, venue, postUrls }
 * @returns {Promise<number>} 생성된 schedule id
 */
export async function createEtcSchedule(db, meilisearch, data) {
  const { title, date, time, description = '', venue = null, postUrls = [] } = data;

  const scheduleId = await withTransaction(db, async (conn) => {
    const venueId = venue ? await upsertVenue(conn, venue) : null;

    const [sResult] = await conn.query(
      `INSERT INTO schedules (category_id, title, date, time) VALUES (1, ?, ?, ?)`,
      [title, date, time || null]
    );
    const sid = sResult.insertId;

    await conn.query(
      `INSERT INTO schedule_etc (schedule_id, venue_id, description, post_urls)
       VALUES (?, ?, ?, ?)`,
      [sid, venueId, description || null, postUrls.length > 0 ? JSON.stringify(postUrls) : null]
    );

    return sid;
  });

  await syncScheduleById(meilisearch, db, scheduleId);
  return scheduleId;
}

/**
 * 장소명(문자열)을 카카오로 지오코딩해 venue 객체 반환 (실패 시 이름만).
 * 서술형 장소명은 뒤 단어부터 줄이며 재시도.
 * @param {string} query - 장소명
 * @returns {Promise<object|null>} { name, address, lat, lng, ... } 또는 null
 */
export async function geocodeVenue(query) {
  if (!query) return null;
  const fallback = { name: query };
  const words = query.trim().split(/\s+/);
  for (let n = words.length; n >= 1; n--) {
    const q = words.slice(0, n).join(' ');
    let docs;
    try {
      docs = await searchKakaoPlace(q);
    } catch {
      return fallback;
    }
    if (docs.length > 0) {
      const venue = kakaoToVenue(docs[0]);
      if (n < words.length) venue.name = query; // 원본 이름 유지
      return venue;
    }
  }
  return fallback;
}

/**
 * 카카오맵 키워드 검색 (국내 장소)
 * @param {string} query - 검색어
 * @returns {Promise<Array>} 카카오 검색 결과 documents
 */
export async function searchKakaoPlace(query) {
  if (!KAKAO_REST_KEY) {
    throw new Error('카카오 API 키가 설정되지 않았습니다.');
  }

  const response = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`,
    { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
  );

  if (!response.ok) {
    throw new Error(`카카오 API 호출 실패: ${response.status}`);
  }

  const data = await response.json();
  return data.documents || [];
}

/**
 * 카카오 검색 결과(document)를 event_venues 형식으로 변환
 */
export function kakaoToVenue(doc) {
  return {
    name: doc.place_name,
    address: doc.address_name || null,
    road_address: doc.road_address_name || null,
    lat: doc.y ? parseFloat(doc.y) : null,
    lng: doc.x ? parseFloat(doc.x) : null,
    kakao_id: doc.id || null,
  };
}
