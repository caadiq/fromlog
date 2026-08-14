import fp from 'fastify-plugin';
import { fetchRecentUploads, getVideoDurations, fetchVideoInfo, fetchAllVideos, fetchShortsLinkedVideo } from './api.js';
import { CATEGORY_IDS } from '../../config/index.js';
import { withTransaction } from '../../utils/transaction.js';
import { syncScheduleById, deleteSchedule } from '../meilisearch/index.js';
import { logActivity } from '../../utils/log.js';
import { archiveVideo } from '../videos.js';
import { refineCategory } from '../videoCategory.js';
import { toKST, formatDateTime, todayKST, weekdayOf, nextWeekday } from '../../utils/date.js';
import { promoteTempSchedule } from '../../utils/tempSchedule.js';

const YOUTUBE_CATEGORY_ID = CATEGORY_IDS.YOUTUBE;

async function youtubeBotPlugin(fastify) {

  /**
   * 해당 날짜의 예정 일정 조회 (is_temp = 1인 것)
   */
  async function findScheduledEntry(bot, date) {
    const [rows] = await fastify.db.query(
      `SELECT sy.schedule_id, s.title, s.date, s.time
       FROM schedule_youtube sy
       JOIN schedules s ON s.id = sy.schedule_id
       WHERE s.is_temp = 1 AND sy.channel_id = ? AND s.date = ?`,
      [bot.channelId, date]
    );
    return rows[0] || null;
  }

  /**
   * 채널의 일반 영상 개수 조회 (쇼츠 제외)
   *
   * titleMatch를 주면 제목에 그 문자열이 든 것만 센다. 한 채널이 프로그램 외
   * 영상(광고 등)도 올리는 경우, 그게 개수에 섞여 회차 번호가 밀리는 걸 막는다.
   */
  async function getVideoCount(channelId, titleMatch = null) {
    const params = [channelId];
    let sql = `SELECT COUNT(*) as cnt FROM schedule_youtube sy
       WHERE sy.channel_id = ? AND sy.video_type = 'video' AND sy.video_id IS NOT NULL`;
    if (titleMatch) {
      sql += ` AND EXISTS (
        SELECT 1 FROM schedules s WHERE s.id = sy.schedule_id AND s.title LIKE ?
      )`;
      params.push(`%${titleMatch}%`);
    }
    const [rows] = await fastify.db.query(sql, params);
    return rows[0].cnt;
  }

  /**
   * 예정 일정 제목 생성
   */
  async function generateScheduledTitle(bot) {
    const { autoScheduleNext } = bot;

    if (autoScheduleNext.titleTemplate) {
      const videoCount = await getVideoCount(bot.channelId, autoScheduleNext.episodeMatch);
      // episodeOffset — 정규 회차에 안 들어가는 영상(예고편 등)이 개수에 섞일 때의 보정값
      const nextEpisode = videoCount + 1 + (autoScheduleNext.episodeOffset || 0);

      return autoScheduleNext.titleTemplate
        .replace('{channelName}', bot.channelName)
        .replace('{episode}', nextEpisode);
    }

    return autoScheduleNext.title || `${bot.channelName} (예정)`;
  }

  /**
   * 다음 주 예정 일정 생성
   */
  async function createScheduledEntry(bot) {
    const { autoScheduleNext } = bot;
    if (!autoScheduleNext) return null;

    const nextDate = nextWeekday(autoScheduleNext.dayOfWeek, autoScheduleNext.weeksAhead || 1);

    // 이미 존재하는지 확인 (같은 채널, 같은 날짜, is_temp = 1)
    const [existing] = await fastify.db.query(
      `SELECT sy.schedule_id FROM schedule_youtube sy
       JOIN schedules s ON s.id = sy.schedule_id
       WHERE s.is_temp = 1 AND sy.channel_id = ? AND s.date = ?`,
      [bot.channelId, nextDate]
    );
    if (existing.length > 0) {
      return null; // 이미 존재
    }

    // 제목 생성
    const title = await generateScheduledTitle(bot);

    // 트랜잭션으로 생성
    const scheduleId = await withTransaction(fastify.db, async (conn) => {
      const [result] = await conn.query(
        'INSERT INTO schedules (category_id, title, date, time, is_temp) VALUES (?, ?, ?, ?, 1)',
        [YOUTUBE_CATEGORY_ID, title, nextDate, autoScheduleNext.time]
      );
      const newScheduleId = result.insertId;

      await conn.query(
        'INSERT INTO schedule_youtube (schedule_id, video_id, video_type, channel_id, channel_name) VALUES (?, ?, ?, ?, ?)',
        [newScheduleId, null, 'video', bot.channelId, bot.channelName]
      );

      return newScheduleId;
    });

    // Meilisearch 동기화
    if (scheduleId) {
      await syncScheduleById(fastify.meilisearch, fastify.db, scheduleId, fastify.redis);
      fastify.log.info(`[${bot.id}] 다음 주 예정 일정 생성: ${nextDate} - ${title}`);
    }

    return scheduleId;
  }

  /**
   * 예정 일정을 실제 영상으로 덮어씌움
   */
  async function updateScheduledEntry(scheduledEntry, video, bot) {
    await withTransaction(fastify.db, async (conn) => {
      // schedules 테이블 업데이트 (is_temp = 0으로 변경)
      await conn.query(
        'UPDATE schedules SET title = ?, date = ?, time = ?, is_temp = 0 WHERE id = ?',
        [video.title, video.date, video.time, scheduledEntry.schedule_id]
      );

      // schedule_youtube 테이블 업데이트
      await conn.query(
        'UPDATE schedule_youtube SET video_id = ?, video_type = ? WHERE schedule_id = ?',
        [video.videoId, video.videoType, scheduledEntry.schedule_id]
      );
    });

    // Meilisearch 동기화
    await syncScheduleById(fastify.meilisearch, fastify.db, scheduledEntry.schedule_id, fastify.redis);
    fastify.log.info(`[${bot.id}] 예정 일정 업데이트: ${video.title}`);

    return scheduledEntry.schedule_id;
  }

  /**
   * 예정 일정 삭제 + 다음 주 예정 일정 생성
   */
  async function deleteScheduledAndCreateNext(bot, scheduleId) {
    // 삭제
    await withTransaction(fastify.db, async (conn) => {
      await conn.query('DELETE FROM schedule_youtube WHERE schedule_id = ?', [scheduleId]);
      await conn.query('DELETE FROM schedules WHERE id = ?', [scheduleId]);
    });

    // Meilisearch에서도 삭제
    await deleteSchedule(fastify.meilisearch, scheduleId, fastify.redis);
    fastify.log.info(`[${bot.id}] 예정 일정 삭제 (영상 미업로드)`);

    // 다음 주 예정 일정 생성
    await createScheduledEntry(bot);
  }

  /**
   * 문자열 비교용 정규화
   * YouTube API는 한글을 NFD(자모 분해형)로 반환하는 반면 DB에 저장된 제목 필터는
   * 보통 NFC(조합형)라, 정규화 없이 includes로 비교하면 눈으로 같아 보여도 매칭에 실패한다.
   */
  function normText(s) {
    return String(s || '').normalize('NFC').toLowerCase();
  }

  /**
   * 제목 필터 매칭 — 제목 + 설명란을 함께 본다.
   * 워크돌 쇼츠처럼 제목에는 아무 키워드가 없고 설명란 해시태그
   * (#프로미스나인 #박지원 …)에만 출연자가 표기되는 채널이 있다.
   */
  function matchesTitleFilters(bot, video) {
    if (!bot.titleFilters || bot.titleFilters.length === 0) return true;
    const haystack = normText(`${video.title}\n${video.description || ''}`);
    return bot.titleFilters.some((filter) => haystack.includes(normText(filter)));
  }

  /**
   * 예정 일정 deadline 체크 (금요일 00시)
   */
  async function checkScheduledDeadline(bot) {
    const { autoScheduleNext } = bot;
    if (!autoScheduleNext || !autoScheduleNext.deadlineDayOfWeek) return;

    const kst = toKST(new Date());

    // deadline 요일인지 확인 (금요일 = 5)
    if (kst.day() !== autoScheduleNext.deadlineDayOfWeek) {
      return;
    }

    // 어제(목요일) 날짜 - deadline 당일이면 전날이 목표 요일
    const targetDateStr = kst.subtract(1, 'day').format('YYYY-MM-DD');

    // 예정 일정이 아직 존재하는지 확인 (is_temp = 1인 것)
    const [rows] = await fastify.db.query(
      `SELECT sy.schedule_id FROM schedule_youtube sy
       JOIN schedules s ON s.id = sy.schedule_id
       WHERE s.is_temp = 1 AND sy.channel_id = ? AND s.date = ?`,
      [bot.channelId, targetDateStr]
    );

    if (rows.length > 0) {
      // 아직 예정 상태 → 삭제 + 다음 주 생성
      await deleteScheduledAndCreateNext(bot, rows[0].schedule_id);
    }
  }

  /**
   * 영상을 DB에 저장
   */
  async function saveVideo(video, bot) {
    // 중복 체크 (video_id로) - 트랜잭션 전에 수행
    const [existing] = await fastify.db.query(
      'SELECT id FROM schedule_youtube WHERE video_id = ?',
      [video.videoId]
    );
    if (existing.length > 0) {
      return null;
    }

    // 커스텀 설정 적용
    // 제목 필터: 하나라도 포함되어야 통과 (제목 + 설명란)
    if (!matchesTitleFilters(bot, video)) {
      return null;
    }

    const { autoScheduleNext } = bot;
    const isVideoType = video.videoType === 'video'; // 쇼츠가 아닌 일반 영상

    // 쇼츠 제외 옵션이 켜진 봇은 쇼츠를 아예 무시
    if (bot.excludeShorts && !isVideoType) {
      return null;
    }

    // 예정 일정 처리 (쇼츠 제외 옵션이 있으면 쇼츠는 무시)
    if (autoScheduleNext && isVideoType) {
      // 해당 날짜의 예정 일정이 있는지 확인
      const scheduledEntry = await findScheduledEntry(bot, video.date);

      if (scheduledEntry) {
        // 예정 일정을 실제 영상으로 덮어씌움
        await updateScheduledEntry(scheduledEntry, video, bot);
        // 다음 주 예정 일정 생성
        await createScheduledEntry(bot);
        return scheduledEntry.schedule_id;
      }
    }

    // 이 봇 소관이 아닌 예정 일정(큐에서 등록한 비정기 콘텐츠)이 이 영상을 기다릴 수 있다.
    // 위의 findScheduledEntry는 `채널 id + 날짜`로만 찾으므로 그건 못 잡는다.
    const promotedId = await promoteTempSchedule(fastify.db, {
      videoId: video.videoId,
      videoType: video.videoType,
      channelId: bot.channelId,
      channelName: bot.channelName,
      title: video.title,
      date: video.date,
      time: video.time,
    });
    if (promotedId) {
      await syncScheduleById(fastify.meilisearch, fastify.db, promotedId, fastify.redis);
      fastify.log.info(`[${bot.id}] 예정 일정 승격(제목 매칭): ${video.title}`);
      return promotedId;
    }

    // 트랜잭션으로 INSERT 작업 수행
    let scheduleId;
    try {
      scheduleId = await withTransaction(fastify.db, async (connection) => {
        // schedules 테이블에 저장
        const [result] = await connection.query(
          'INSERT INTO schedules (category_id, title, date, time) VALUES (?, ?, ?, ?)',
          [YOUTUBE_CATEGORY_ID, video.title, video.date, video.time]
        );
        const newScheduleId = result.insertId;

        // schedule_youtube 테이블에 저장
        await connection.query(
          'INSERT INTO schedule_youtube (schedule_id, video_id, video_type, channel_id, channel_name) VALUES (?, ?, ?, ?, ?)',
          [newScheduleId, video.videoId, video.videoType, video.channelId, bot.channelName]
        );

        return newScheduleId;
      });
    } catch (err) {
      // UNIQUE 제약 위반 (동시성 중복) → 무시
      if (err.code === 'ER_DUP_ENTRY') return null;
      throw err;
    }

    // 새 영상 추가 후 다음 주 예정 일정 생성 (쇼츠 제외)
    // 단, 정기 업로드 요일에 올라온 영상일 때만 — 비정기 추가분(광고 등)까지 트리거하면
    // 다음 주 예정 일정이 별도로 하나 더 생겨 달력에 예정이 중복되고 화수도 밀린다
    if (
      autoScheduleNext &&
      isVideoType &&
      scheduleId &&
      weekdayOf(video.date) === autoScheduleNext.dayOfWeek
    ) {
      await createScheduledEntry(bot);
    }

    return scheduleId;
  }

  /**
   * 최근 영상 동기화 (정기 실행)
   */
  /**
   * 필터로 거부된 영상 ID 기록 — 다음 sync에서 재조회하지 않도록 (쿼터 절약)
   * 이게 없으면 쇼츠/제목 필터로 거부된 영상이 DB에 안 남아 매 sync마다
   * videos.list(영상당 1 unit)로 영원히 재조회된다.
   */
  async function recordSkipped(videoIds, channelId, reason) {
    if (!videoIds || videoIds.length === 0) return;
    await fastify.db.query(
      'INSERT IGNORE INTO youtube_skipped_videos (video_id, channel_id, reason) VALUES ?',
      [videoIds.map((id) => [id, channelId, reason])]
    );
  }

  async function syncNewVideos(bot) {
    // 예정 일정 deadline 체크 (금요일 00시)
    if (bot.autoScheduleNext) {
      await checkScheduledDeadline(bot);
    }

    // 1. 최근 업로드 조회 — activities.list 1 unit (제목·설명 스니펫 포함, 추가 비용 0)
    //    50개를 받아도 비용은 동일하므로, 폴링 간격이 길거나 업로드가 몰리는
    //    채널(음방 등)에서 누락되지 않도록 최대치로 조회한다.
    const uploads = await fetchRecentUploads(bot.channelId, 50);
    if (uploads.length === 0) {
      return { addedCount: 0, total: 0, foundTarget: false };
    }
    const total = uploads.length;
    const ids = uploads.map((u) => u.videoId);

    // 2. 이미 처리된 영상 제외 — 일정(schedule_youtube) + 필터 거부(skipped) + 아카이브(videos)
    //    (아카이브 전용 봇(add_to_schedule=0)은 videos 적재가 곧 "처리 완료" 표시)
    const [saved] = await fastify.db.query(
      'SELECT video_id FROM schedule_youtube WHERE video_id IN (?)',
      [ids]
    );
    const [skipped] = await fastify.db.query(
      'SELECT video_id FROM youtube_skipped_videos WHERE video_id IN (?)',
      [ids]
    );
    const [archived] = await fastify.db.query(
      'SELECT video_id FROM videos WHERE video_id IN (?)',
      [ids]
    );
    const seen = new Set([
      ...saved.map((r) => r.video_id),
      ...skipped.map((r) => r.video_id),
      ...archived.map((r) => r.video_id),
    ]);
    let candidates = uploads.filter((u) => !seen.has(u.videoId));

    // 평상시(새 영상 없음)엔 여기서 종료 → sync 1회 = activities.list 1 unit
    if (candidates.length === 0) {
      return { addedCount: 0, total, foundTarget: false };
    }

    let addedCount = 0;
    let foundTarget = false; // 오늘 게시된 일반 영상(그날의 본편)을 저장했는지
    const today = todayKST();

    // 3. 제목 필터 — 스니펫 title+description으로 판별 (videos.list 호출 없이 무료)
    if (bot.titleFilters && bot.titleFilters.length > 0) {
      const pass = candidates.filter((u) => matchesTitleFilters(bot, u));
      let rejected = candidates.filter((u) => !pass.includes(u));

      // 제목·설명란이 모두 비어 판별 불가한 쇼츠 — 연결된 본편 제목으로 폴백 판별
      // (예: 워크돌 쇼츠 "박지원도 못 이기는 박지원"은 설명이 없지만 본편 제목에 그룹명이 있다)
      for (const u of rejected.filter((r) => !r.description)) {
        const linked = await fetchShortsLinkedVideo(u.videoId);
        if (linked && matchesTitleFilters(bot, linked)) {
          pass.push(u);
          rejected = rejected.filter((r) => r !== u);
        }
      }

      await recordSkipped(rejected.map((u) => u.videoId), bot.channelId, 'title_filter');
      candidates = pass;
      if (candidates.length === 0) return { addedCount, total, foundTarget };
    }

    // 4. 쇼츠 판별 — videos.list 1 unit으로 최대 50개 배치
    //    (아카이브 video_type에도 필요하므로 excludeShorts와 무관하게 항상 수행)
    const durationMap = await getVideoDurations(candidates.map((u) => u.videoId));

    // 4.5. 영상 아카이브 적재 — 제목 필터를 통과한 영상은 기본적으로 쇼츠까지 전부 적재
    //      (excludeShorts는 "일정" 정책일 뿐, 영상 페이지에는 쇼츠도 표시)
    //      예외 1: 음방 채널처럼 아카이브 전용 봇은 인터뷰 클립을 담지 않는다.
    //      예외 2: archiveShorts=false 채널은 쇼츠를 아예 담지 않는다 — 풀무원처럼
    //              쇼츠 대부분이 게스트 단독 클립이라 제목·설명으로 가려낼 수 없는 경우.
    const ARCHIVE_SKIP_RE = /인터뷰|interview/i;
    for (const cand of candidates) {
      if (bot.addToSchedule === false && ARCHIVE_SKIP_RE.test(cand.title)) continue;
      if (bot.archiveShorts === false && durationMap[cand.videoId]?.isShorts) continue;
      await archiveVideo(fastify.db, {
        videoId: cand.videoId,
        channelId: bot.channelId,
        channelName: bot.channelName,
        title: cand.title,
        // 음방 채널은 무대 외에 자체 예능도 올리므로 제목으로 한 번 더 거른다
        category: await refineCategory(fastify.db, bot.videoCategory || 'variety', cand.title),
        videoType: durationMap[cand.videoId]?.isShorts ? 'shorts' : 'video',
        duration: durationMap[cand.videoId]?.seconds ?? null,
        publishedAt: formatDateTime(cand.publishedAt),
      });
    }

    // 아카이브 전용 봇 — 일정을 새로 만들지는 않지만, 큐에서 등록한 예정 일정이
    // 이 영상을 기다리고 있으면 채워준다. (음방 채널의 자체 예능이 여기 해당한다 —
    // 이 봇은 일정을 안 만들고 X봇은 '관리 중인 채널'이라 건너뛰어, 안 채우면 아무도 안 채운다)
    if (bot.addToSchedule === false) {
      for (const cand of candidates) {
        const publishedAt = formatDateTime(cand.publishedAt);
        const promotedId = await promoteTempSchedule(fastify.db, {
          videoId: cand.videoId,
          videoType: durationMap[cand.videoId]?.isShorts ? 'shorts' : 'video',
          channelId: bot.channelId,
          channelName: bot.channelName,
          title: cand.title,
          date: publishedAt.slice(0, 10),
          time: publishedAt.slice(11),
        });
        if (promotedId) {
          await syncScheduleById(fastify.meilisearch, fastify.db, promotedId, fastify.redis);
          fastify.log.info(`[${bot.id}] 예정 일정 승격(아카이브 전용 봇): ${cand.title}`);
        }
      }
      return { addedCount: candidates.length, total, foundTarget };
    }

    if (bot.excludeShorts) {
      const shorts = candidates.filter((u) => durationMap[u.videoId]?.isShorts);
      await recordSkipped(shorts.map((u) => u.videoId), bot.channelId, 'shorts');
      candidates = candidates.filter((u) => !durationMap[u.videoId]?.isShorts);
      if (candidates.length === 0) return { addedCount, total, foundTarget };
    }

    // 5. 필터를 통과한 영상만 상세 조회 (videos.list - 영상당 1 unit)
    for (const cand of candidates) {
      const video = await fetchVideoInfo(cand.videoId);
      if (!video) continue;

      const scheduleId = await saveVideo(video, bot);
      if (scheduleId) {
        if (video.videoType === 'video' && video.date === today) {
          foundTarget = true;
        }
        await syncScheduleById(fastify.meilisearch, fastify.db, scheduleId, fastify.redis);
        logActivity(fastify.db, {
          actor: bot.id,
          action: 'create',
          category: 'schedule',
          targetType: 'youtube_schedule',
          targetId: scheduleId,
          summary: `YouTube 영상 추가: ${video.title}`,
        });
        addedCount++;
      } else {
        // saveVideo가 거부 → 재조회 방지
        await recordSkipped([cand.videoId], bot.channelId, 'other');
      }
    }

    return { addedCount, total, foundTarget };
  }

  /**
   * 전체 영상 동기화 (초기화)
   */
  async function syncAllVideos(bot) {
    const videos = await fetchAllVideos(bot.channelId);
    let addedCount = 0;

    for (const video of videos) {
      const scheduleId = await saveVideo(video, bot);
      if (scheduleId) {
        // Meilisearch 동기화
        await syncScheduleById(fastify.meilisearch, fastify.db, scheduleId, fastify.redis);
        addedCount++;
      }
    }

    return { addedCount, total: videos.length };
  }

  fastify.decorate('youtubeBot', {
    syncNewVideos,
    syncAllVideos,
    saveVideo,
    checkScheduledDeadline,
  });
}

export default fp(youtubeBotPlugin, {
  name: 'youtubeBot',
  dependencies: ['db'],
});
