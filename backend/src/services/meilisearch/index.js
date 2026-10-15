/**
 * Meilisearch 검색 서비스
 * - 일정 검색 (검색 별칭 및 학교 약칭 연결)
 * - 영문 자판 → 한글 변환
 * - 유사도 필터링
 * - 일정 동기화
 */
import { createLogger } from '../../utils/logger.js';
import { normalizeTerm } from '../searchAliases.js';
export { searchSchedules } from './search.js';
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

const logger = createLogger('Meilisearch');
const INDEX_NAME = 'schedules';

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
        COALESCE(sy.channel_name, sx.username, se.school_name, sv.broadcaster) as source_name,
        sv.broadcaster,
        CONCAT_WS(' ', sv.description, se.description, sec.description, sx.content) as description
      FROM schedules s
      LEFT JOIN schedule_categories c ON s.category_id = c.id
      LEFT JOIN schedule_youtube sy ON s.id = sy.schedule_id
      LEFT JOIN schedule_x sx ON s.id = sx.schedule_id
      LEFT JOIN schedule_event se ON s.id = se.schedule_id
      LEFT JOIN schedule_variety sv ON s.id = sv.schedule_id
      LEFT JOIN schedule_etc sec ON s.id = sec.schedule_id`;

/**
 * 일정 행/객체 → Meilisearch 문서 (모든 sync 경로 공통 형태)
 * date가 Date 객체면 'YYYY-MM-DD' 문자열로 정규화한다.
 */
function buildScheduleDocument(row) {
  return {
    id: row.id,
    title: (row.title || '').normalize('NFC'),
    title_compact: normalizeTerm(row.title),
    description: (row.description || '').normalize('NFC'),
    broadcaster: (row.broadcaster || '').normalize('NFC'),
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
    time: row.time || '',
    category_id: row.category_id,
    category_name: row.category_name || '',
    category_color: row.category_color || '',
    source_name: (row.source_name || '').normalize('NFC'),
  };
}


/**
 * 일정 추가/업데이트 (데이터 직접 전달)
 */
export async function addOrUpdateSchedule(meilisearch, schedule, redis = null) {
  try {
    const index = meilisearch.index(INDEX_NAME);

    const document = buildScheduleDocument(schedule);

    await waitForIndexTask(meilisearch, await index.addDocuments([document]));
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
    await waitForIndexTask(meilisearch, await index.addDocuments([document]));
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
    await waitForIndexTask(meilisearch, await index.deleteDocument(scheduleId));
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
      await waitForIndexTask(meilisearch, await index.deleteDocuments(idsToDelete));
      logger.info(`${idsToDelete.length}개 문서 삭제`);
    }

    // 문서 변환 (addDocuments는 같은 ID면 자동 업데이트)
    const documents = schedules.map(buildScheduleDocument);

    // 일괄 추가
    if (documents.length) await waitForIndexTask(meilisearch, await index.addDocuments(documents));
    logger.info(`${documents.length}개 일정 동기화 완료`);

    return documents.length;
  } catch (err) {
    logger.error(`동기화 오류: ${err.message}`);
    throw err;
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

/** Retry without deleting a healthy index after a transient database failure. */
export async function syncWithRetry(meilisearch, db) {
  try {
    return await syncAllSchedules(meilisearch, db);
  } catch (err) {
    logger.warn(`동기화 재시도: ${err.message}`);
    return await syncAllSchedules(meilisearch, db);
  }
}

async function waitForIndexTask(meilisearch, task) {
  const result = await meilisearch.waitForTask(task.taskUid, { timeOutMs: 10000 });
  if (result.status !== 'succeeded') {
    throw new Error(result.error?.message || `Search index task ${result.status}`);
  }
}
