/**
 * Meilisearch 검색 서비스
 * - 일정 검색 (멤버 별명 → 이름 변환)
 * - 영문 자판 → 한글 변환
 * - 유사도 필터링
 * - 일정 동기화
 */
import Inko from 'inko';
import config, { CATEGORY_IDS } from '../../config/index.js';
import { createLogger } from '../../utils/logger.js';
import { invalidatePattern } from '../../utils/cache.js';

// 일정 쓰기 시 월별 일정 캐시 무효화 (redis가 주어진 호출에 한함)
async function invalidateMonthlyCache(redis) {
  if (!redis) return;
  try {
    await invalidatePattern(redis, 'schedule:monthly:*');
  } catch {
    // 캐시 무효화 실패는 치명적이지 않음 (TTL로 자동 만료)
  }
}

const inko = new Inko();
const logger = createLogger('Meilisearch');
const INDEX_NAME = 'schedules';
const MIN_SCORE = config.meilisearch.minScore;

/**
 * 일정 동기화용 SELECT — 카테고리명·색과 소스명(유튜브 채널/X 계정/행사 학교)을 조인.
 * WHERE 없이 전체, 또는 뒤에 'WHERE s.id = ?'를 붙여 단건 조회. (GROUP BY는 호출부에서)
 */
const SCHEDULE_SYNC_SELECT = `
      SELECT
        s.id,
        s.title,
        s.date,
        s.time,
        s.category_id,
        c.name as category_name,
        c.color as category_color,
        COALESCE(sy.channel_name, sx.username, se.school_name) as source_name
      FROM schedules s
      LEFT JOIN schedule_categories c ON s.category_id = c.id
      LEFT JOIN schedule_youtube sy ON s.id = sy.schedule_id
      LEFT JOIN schedule_x sx ON s.id = sx.schedule_id
      LEFT JOIN schedule_event se ON s.id = se.schedule_id`;

/**
 * 일정 행/객체 → Meilisearch 문서 (모든 sync 경로 공통 형태)
 * date가 Date 객체면 'YYYY-MM-DD' 문자열로 정규화한다.
 */
function buildScheduleDocument(row) {
  return {
    id: row.id,
    title: row.title,
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
    time: row.time || '',
    category_id: row.category_id,
    category_name: row.category_name || '',
    category_color: row.category_color || '',
    source_name: row.source_name || '',
  };
}


/**
 * 영문 자판으로 입력된 검색어인지 확인
 */
function isEnglishKeyboard(text) {
  const englishChars = text.match(/[a-zA-Z]/g) || [];
  const koreanChars = text.match(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g) || [];
  return englishChars.length > 0 && koreanChars.length === 0;
}

/**
 * 부분 이름으로 학교명 조회 (예: "인천대" → "인천대학교")
 */
async function resolveSchoolNames(db, query) {
  const searchTerm = `%${query}%`;
  const [rows] = await db.query(
    `SELECT DISTINCT school_name FROM schedule_event WHERE school_name LIKE ?`,
    [searchTerm]
  );
  return rows.map(r => r.school_name).filter(Boolean);
}

/**
 * 일정 검색
 * @param {object} meilisearch - Meilisearch 클라이언트
 * @param {object} db - DB 연결 풀
 * @param {string} query - 검색어
 * @param {object} options - 검색 옵션 (offset, limit for pagination)
 */
export async function searchSchedules(meilisearch, db, query, options = {}) {
  const { limit = 100, offset = 0 } = options;
  // 내부 검색 한도 (여러 검색어 병합 및 유사도 필터링 전 충분한 결과 확보)
  const SEARCH_LIMIT = 1000;

  try {
    const index = meilisearch.index(INDEX_NAME);

    const searchOptions = {
      limit: SEARCH_LIMIT,
      offset: 0, // 내부적으로 전체 검색 후 필터링
      attributesToRetrieve: ['*'],
      showRankingScore: true,
    };

    // 검색어 목록 구성
    const searchQueries = [query];

    // 영문 자판 입력 → 한글 변환
    if (isEnglishKeyboard(query)) {
      const koreanQuery = inko.en2ko(query);
      if (koreanQuery !== query) {
        searchQueries.push(koreanQuery);
      }
    }

    // 부분 이름 → 전체 학교명 변환 (예: "인천대" → "인천대학교")
    const schoolNames = await resolveSchoolNames(db, query);
    for (const name of schoolNames) {
      if (!searchQueries.includes(name)) {
        searchQueries.push(name);
      }
    }

    // 각 검색어로 검색 후 병합
    const allHits = new Map(); // id 기준 중복 제거

    for (const q of searchQueries) {
      const results = await index.search(q, searchOptions);
      for (const hit of results.hits) {
        // 더 높은 점수로 업데이트
        if (!allHits.has(hit.id) || allHits.get(hit.id)._rankingScore < hit._rankingScore) {
          allHits.set(hit.id, hit);
        }
      }
    }

    // 유사도 필터링
    let filteredHits = Array.from(allHits.values())
      .filter(hit => hit._rankingScore >= MIN_SCORE);

    // 유사도 순 정렬
    filteredHits.sort((a, b) => (b._rankingScore || 0) - (a._rankingScore || 0));

    const total = filteredHits.length;

    // 페이징 적용
    const paginatedHits = filteredHits.slice(offset, offset + limit);

    // 응답 형식 변환
    const formattedHits = paginatedHits.map(formatScheduleResponse);

    return {
      hits: formattedHits,
      total,
      offset,
      limit,
      hasMore: offset + paginatedHits.length < total,
    };
  } catch (err) {
    logger.error(`검색 오류: ${err.message}`);
    return { hits: [], total: 0, offset: 0, limit, hasMore: false };
  }
}

/**
 * 검색 결과 응답 형식 변환
 * schedule.js의 공통 포맷과 동일한 구조 반환
 * (Meilisearch 인덱스 필드명이 다르므로 별도 매핑 필요)
 */
function formatScheduleResponse(hit) {
  // source 객체 구성 (Meilisearch에는 URL 없음)
  let source = null;
  if (hit.category_id === CATEGORY_IDS.YOUTUBE && hit.source_name) {
    source = { name: hit.source_name, url: null };
  } else if (hit.category_id === CATEGORY_IDS.X) {
    source = { name: hit.source_name || '', url: null };
  } else if (hit.category_id === CATEGORY_IDS.EVENT && hit.source_name) {
    source = { name: hit.source_name, url: null };
  }

  return {
    id: hit.id,
    title: hit.title,
    date: hit.date,
    time: hit.time || null,
    category: {
      id: hit.category_id,
      name: hit.category_name,
      color: hit.category_color,
    },
    source,
  };
}

/**
 * 일정 추가/업데이트 (데이터 직접 전달)
 */
export async function addOrUpdateSchedule(meilisearch, schedule, redis = null) {
  try {
    const index = meilisearch.index(INDEX_NAME);

    const document = buildScheduleDocument(schedule);

    await index.addDocuments([document]);
    logger.info(`일정 추가/업데이트: ${schedule.id}`);
  } catch (err) {
    logger.error(`문서 추가 오류: ${err.message}`);
  }
  await invalidateMonthlyCache(redis);
}

/**
 * 일정 ID로 DB에서 조회 후 Meilisearch에 동기화
 */
export async function syncScheduleById(meilisearch, db, scheduleId, redis = null) {
  try {
    const [rows] = await db.query(
      `${SCHEDULE_SYNC_SELECT}\n      WHERE s.id = ?\n      GROUP BY s.id`,
      [scheduleId]
    );

    if (rows.length === 0) {
      logger.warn(`일정을 찾을 수 없음: ${scheduleId}`);
      return false;
    }

    const document = buildScheduleDocument(rows[0]);

    const index = meilisearch.index(INDEX_NAME);
    await index.addDocuments([document]);
    logger.info(`일정 동기화: ${scheduleId}`);
    await invalidateMonthlyCache(redis);
    return true;
  } catch (err) {
    logger.error(`일정 동기화 오류 (${scheduleId}): ${err.message}`);
    await invalidateMonthlyCache(redis);
    return false;
  }
}

/**
 * 일정 삭제
 */
export async function deleteSchedule(meilisearch, scheduleId, redis = null) {
  try {
    const index = meilisearch.index(INDEX_NAME);
    await index.deleteDocument(scheduleId);
    logger.info(`일정 삭제: ${scheduleId}`);
  } catch (err) {
    logger.error(`문서 삭제 오류: ${err.message}`);
  }
  await invalidateMonthlyCache(redis);
}

/**
 * 전체 일정 동기화 (DB에 없는 문서는 삭제)
 */
export async function syncAllSchedules(meilisearch, db) {
  try {
    // DB에서 모든 일정 조회
    const [schedules] = await db.query(`${SCHEDULE_SYNC_SELECT}\n      GROUP BY s.id`);

    const index = meilisearch.index(INDEX_NAME);
    const dbIds = new Set(schedules.map(s => s.id));

    // Meilisearch에서 모든 문서 ID 조회
    let meiliIds = [];
    let offset = 0;
    const limit = 1000;
    while (true) {
      const docs = await index.getDocuments({ offset, limit, fields: ['id'] });
      if (docs.results.length === 0) break;
      meiliIds.push(...docs.results.map(d => d.id));
      if (docs.results.length < limit) break;
      offset += limit;
    }

    // DB에 없는 문서 삭제
    const idsToDelete = meiliIds.filter(id => !dbIds.has(id));
    if (idsToDelete.length > 0) {
      await index.deleteDocuments(idsToDelete);
      logger.info(`${idsToDelete.length}개 문서 삭제`);
    }

    // 문서 변환 (addDocuments는 같은 ID면 자동 업데이트)
    const documents = schedules.map(buildScheduleDocument);

    // 일괄 추가
    await index.addDocuments(documents);
    logger.info(`${documents.length}개 일정 동기화 완료`);

    return documents.length;
  } catch (err) {
    logger.error(`동기화 오류: ${err.message}`);
    return 0;
  }
}

/**
 * Meilisearch 버전 조회
 */
export async function getVersion(meilisearch) {
  try {
    const version = await meilisearch.getVersion();
    return version.pkgVersion;
  } catch (err) {
    logger.error(`버전 조회 오류: ${err.message}`);
    return null;
  }
}

/**
 * 인덱스 삭제 후 재생성
 */
async function recreateIndex(meilisearch) {
  const index = meilisearch.index(INDEX_NAME);

  try {
    // 인덱스 삭제
    const deleteTask = await meilisearch.deleteIndex(INDEX_NAME);
    await meilisearch.waitForTask(deleteTask.taskUid);
    logger.info('기존 인덱스 삭제 완료');
  } catch (err) {
    // 인덱스가 없으면 무시
  }

  // 인덱스 재생성
  const createTask = await meilisearch.createIndex(INDEX_NAME, { primaryKey: 'id' });
  await meilisearch.waitForTask(createTask.taskUid);

  // 설정 복원
  await index.updateSearchableAttributes([
    'title', 'source_name', 'category_name',
  ]);
  await index.updateFilterableAttributes(['category_id', 'date']);
  await index.updateSortableAttributes(['date', 'time']);
  await index.updateRankingRules([
    'words', 'typo', 'proximity', 'attribute', 'exactness', 'date:desc',
  ]);
  await index.updateTypoTolerance({
    enabled: true,
    minWordSizeForTypos: { oneTypo: 2, twoTypos: 4 },
  });
  await index.updatePagination({ maxTotalHits: 10000 });

  logger.info('인덱스 재생성 완료');
}

/**
 * 동기화 (오류 시 인덱스 재생성 후 재시도)
 */
export async function syncWithRetry(meilisearch, db) {
  try {
    const count = await syncAllSchedules(meilisearch, db);
    if (count > 0) return count;

    // 0개면 오류일 수 있으므로 재시도
    throw new Error('동기화 결과 0개');
  } catch (err) {
    logger.warn(`동기화 실패, 인덱스 재생성 후 재시도: ${err.message}`);

    try {
      await recreateIndex(meilisearch);
      return await syncAllSchedules(meilisearch, db);
    } catch (retryErr) {
      logger.error(`재시도 실패: ${retryErr.message}`);
      return 0;
    }
  }
}
