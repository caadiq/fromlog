import fp from 'fastify-plugin';
import cron from 'node-cron';
import staticBots from '../config/bots.js';
import { syncAllSchedules } from '../services/meilisearch/index.js';
import { nowKST } from '../utils/date.js';
import { logActivity } from '../utils/log.js';
import { sendOpsAlert } from '../services/push.js';
import { parseJsonColumn as safeParse } from '../utils/json.js';

const REDIS_PREFIX = 'bot:status:';
const TIMEZONE = 'Asia/Seoul';
const MAX_CONSECUTIVE_ERRORS = 10;


/**
 * 에러 객체에서 활동 로그용 details 구성
 * - err.cause(Node fetch failed의 진짜 원인 등), err.code를 함께 포함
 */
function buildErrorDetails(err) {
  const d = { error: err.message };
  if (err.code) d.code = err.code;
  if (err.cause) {
    d.cause = err.cause.message || String(err.cause);
    if (err.cause.code) d.causeCode = err.cause.code;
  }
  return d;
}

/**
 * 봇 실패 원인을 사람이 읽을 수 있는 사유 + 조치로 분류 (푸시 알림용)
 * 원본 메시지("HTTP 404", "요청 타임아웃")만으로는 무엇을 해야 할지 알 수 없어서,
 * 흔한 실패 유형을 알아보기 쉬운 문장으로 바꾼다.
 * @returns {{reason: string, action: string}}
 */
export function describeBotError(bot, err) {
  const msg = String(err?.message || '');
  const cause = String(err?.cause?.message || '');
  const code = String(err?.code || err?.cause?.code || '');
  const all = `${msg} ${cause} ${code}`.toLowerCase();
  const isX = bot?.type === 'x';

  // YouTube API 할당량
  if (all.includes('quota') || all.includes('quotaexceeded')) {
    return {
      reason: 'YouTube API 할당량 초과',
      action: '내일 할당량이 초기화될 때까지 기다리거나 봇 주기를 늘려주세요.',
    };
  }
  // API 키 문제
  if (all.includes('api key not valid') || all.includes('api_key_invalid') || all.includes('keyinvalid')) {
    return { reason: 'YouTube API 키 오류', action: 'GOOGLE_API_KEY 값을 확인해주세요.' };
  }
  // X 봇: 타임아웃·5xx는 대부분 Nitter 세션 만료
  if (isX && (all.includes('타임아웃') || all.includes('timeout') || all.includes('abort'))) {
    return {
      reason: 'X 세션 만료로 보입니다 (Nitter 응답 없음)',
      action: '브라우저 쿠키(auth_token·ct0)로 세션을 갱신해주세요.',
    };
  }
  if (isX && /http (50\d|429)/i.test(msg)) {
    return {
      reason: 'X 접근 차단 또는 세션 만료',
      action: '잠시 후에도 계속되면 세션 쿠키를 갱신해주세요.',
    };
  }
  // 레이트 리밋
  if (all.includes('http 429') || all.includes('rate limit')) {
    return { reason: '요청이 너무 잦아 차단됨 (레이트 리밋)', action: '봇 주기를 늘려주세요.' };
  }
  // 대상 없음
  if (all.includes('http 404')) {
    return {
      reason: '대상을 찾을 수 없음',
      action: isX ? '계정명이 바뀌었거나 삭제됐는지 확인해주세요.' : '채널 정보를 확인해주세요.',
    };
  }
  // 권한
  if (all.includes('http 403')) {
    return { reason: '접근 권한 없음 (403)', action: 'API 키 권한이나 대상 공개 여부를 확인해주세요.' };
  }
  // 네트워크·DNS
  if (
    all.includes('econnrefused') || all.includes('enotfound') ||
    all.includes('econnreset') || all.includes('fetch failed') || all.includes('getaddrinfo')
  ) {
    return {
      reason: '네트워크 연결 실패',
      action: '연동 서비스(Nitter 등) 컨테이너가 떠 있는지 확인해주세요.',
    };
  }
  // 일반 타임아웃
  if (all.includes('타임아웃') || all.includes('timeout') || all.includes('abort')) {
    return { reason: '응답 시간 초과', action: '대상 서비스 상태를 확인해주세요.' };
  }
  // DB
  if (code.startsWith('ER_') || all.includes('econnrefused 3306')) {
    return { reason: '데이터베이스 오류', action: 'DB 컨테이너 상태를 확인해주세요.' };
  }

  return { reason: msg || '알 수 없는 오류', action: '관리자 로그에서 상세 내용을 확인해주세요.' };
}

async function schedulerPlugin(fastify, opts) {
  const tasks = new Map();
  const burstTimers = new Map();  // weekly 모드 내부 setInterval 핸들
  let cachedBots = null;

  /**
   * DB에서 YouTube 봇 목록 조회
   */
  async function getYouTubeBotsFromDB() {
    const [rows] = await fastify.db.query(
      'SELECT * FROM bot_youtube'
    );
    return rows.map(row => {
      const weekly = safeParse(row.weekly_schedule_config, null);

      // weekly 모드면 시작 시각에만 트리거, 아니면 cron_interval 분 주기
      let cronExpr;
      if (weekly && weekly.startTime && weekly.dayOfWeek !== undefined) {
        const [h, m] = weekly.startTime.split(':').map(Number);
        cronExpr = `${m} ${h} * * ${weekly.dayOfWeek}`;
      } else {
        cronExpr = `*/${row.cron_interval || 2} * * * *`;
      }

      return {
        id: `youtube-${row.id}`,  // DB ID를 문자열 형식으로 변환
        dbId: row.id,
        type: 'youtube',
        channelId: row.channel_id,
        channelHandle: row.channel_handle,
        channelName: row.channel_name,
        bannerUrl: row.banner_url,
        cron: cronExpr,
        enabled: row.enabled === 1,
        titleFilters: safeParse(row.title_filters, []),
        excludeShorts: row.exclude_shorts === 1,
        archiveShorts: row.archive_shorts !== 0,
        autoScheduleNext: safeParse(row.auto_schedule_config, null),
        weeklySchedule: weekly,
        videoCategory: row.video_category || 'variety',
        addToSchedule: row.add_to_schedule !== 0,
      };
    });
  }

  /**
   * DB에서 X 봇 목록 조회
   */
  async function getXBotsFromDB() {
    const [rows] = await fastify.db.query(
      'SELECT * FROM bot_x'
    );
    return rows.map(row => ({
      id: `x-${row.id}`,
      dbId: row.id,
      type: 'x',
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      nitterUrl: process.env.NITTER_URL || 'http://nitter:8080',
      cron: `*/${row.cron_interval} * * * *`,
      enabled: row.enabled === 1,
      textFilters: safeParse(row.text_filters, []),
      includeRetweets: row.include_retweets === 1,
      extractYoutube: row.extract_youtube === 1,
      excludeManagedChannels: row.exclude_managed_channels === 1,
    }));
  }

  /**
   * 동기화 간격(분)을 cron 표현식으로 변환
   * - 60분 미만: 분 단위 (*\/N * * * *)
   * - 60분 이상: 시간 단위 (0 *\/H * * *)
   */
  function intervalToCron(minutes) {
    if (!minutes || minutes < 60) {
      return `*/${minutes || 2} * * * *`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours >= 24) {
      return '0 0 * * *';
    }
    return `0 */${hours} * * *`;
  }

  /**
   * DB에서 축제 봇 목록 조회
   */
  async function getFestivalBotsFromDB() {
    const [rows] = await fastify.db.query('SELECT * FROM bot_festival');
    return rows.map(row => ({
      id: `festival-${row.id}`,
      dbId: row.id,
      type: 'festival',
      name: row.name,
      searchUrl: row.search_url,
      cron: intervalToCron(row.cron_interval),
      cronInterval: row.cron_interval,
      enabled: row.enabled === 1,
    }));
  }

  /**
   * 모든 봇 목록 가져오기 (정적 + DB)
   */
  async function getAllBots(forceRefresh = false) {
    if (cachedBots && !forceRefresh) {
      return cachedBots;
    }
    const youtubeBots = await getYouTubeBotsFromDB();
    const xBots = await getXBotsFromDB();
    const festivalBots = await getFestivalBotsFromDB();
    cachedBots = [...staticBots, ...youtubeBots, ...xBots, ...festivalBots];
    return cachedBots;
  }

  /**
   * 봇 ID로 봇 찾기
   */
  async function findBot(botId) {
    const allBots = await getAllBots();
    return allBots.find(b => b.id === botId);
  }

  /**
   * 봇 상태 Redis에 저장
   */
  async function updateStatus(botId, status) {
    const current = await getStatus(botId);
    const updated = { ...current, ...status, updatedAt: nowKST() };
    await fastify.redis.set(`${REDIS_PREFIX}${botId}`, JSON.stringify(updated));
    return updated;
  }

  /**
   * 봇 상태 Redis에서 조회
   */
  async function getStatus(botId) {
    const data = await fastify.redis.get(`${REDIS_PREFIX}${botId}`);
    if (data) {
      return JSON.parse(data);
    }
    return {
      status: 'stopped',
      lastCheckAt: null,
      lastAddedCount: 0,
      totalAdded: 0,
      lastSyncDuration: null,
      errorMessage: null,
      consecutiveErrors: 0,
    };
  }

  /**
   * 봇 동기화 함수 가져오기
   */
  function getSyncFunction(bot) {
    if (bot.type === 'youtube') {
      return fastify.youtubeBot.syncNewVideos;
    } else if (bot.type === 'x') {
      return fastify.xBot.syncNewTweets;
    } else if (bot.type === 'festival') {
      return fastify.festivalBot.syncNewFestivals;
    } else if (bot.type === 'meilisearch') {
      return async () => {
        const count = await syncAllSchedules(fastify.meilisearch, fastify.db);
        return { addedCount: count, total: count };
      };
    }
    return null;
  }

  /**
   * 동기화 결과 처리
   */
  async function handleSyncResult(botId, result, options = {}) {
    const { setRunningStatus = false } = options;
    const status = await getStatus(botId);
    const updateData = {
      lastCheckAt: nowKST(),
      totalAdded: (status.totalAdded || 0) + result.addedCount,
      consecutiveErrors: 0,
    };
    if (setRunningStatus) {
      updateData.status = 'running';
      updateData.errorMessage = null;
    }
    if (result.addedCount > 0) {
      updateData.lastAddedCount = result.addedCount;
    }
    await updateStatus(botId, updateData);
    return result.addedCount;
  }

  /**
   * DB의 enabled 필드 업데이트 (정적 봇은 무시)
   */
  async function setEnabled(botId, enabled) {
    const match = botId.match(/^(youtube|x|festival)-(\d+)$/);
    if (!match) return; // 정적 봇 (meilisearch 등)
    const tableMap = { x: 'bot_x', youtube: 'bot_youtube', festival: 'bot_festival' };
    const table = tableMap[match[1]];
    const dbId = match[2];
    await fastify.db.query(`UPDATE ${table} SET enabled = ? WHERE id = ?`, [enabled ? 1 : 0, dbId]);
    invalidateCache();
  }

  /**
   * 단일 동기화 실행 + 에러 처리 (consecutiveErrors, 자동 정지 포함)
   */
  async function runSync(botId, bot, syncFn, { setRunningStatus = false } = {}) {
    try {
      const result = await syncFn(bot);
      const addedCount = await handleSyncResult(botId, result, { setRunningStatus });
      fastify.log.info(`[${botId}] 동기화 완료: ${addedCount}개 추가`);
      if (addedCount > 0) {
        logActivity(fastify.db, {
          actor: botId,
          action: 'sync_complete',
          category: 'sync',
          summary: `${botId} 동기화 완료: ${addedCount}개 추가`,
          details: { addedCount },
        });
      }
      return { ok: true, addedCount, foundTarget: result?.foundTarget === true };
    } catch (err) {
      const prev = await getStatus(botId);
      const consecutiveErrors = (prev.consecutiveErrors || 0) + 1;
      await updateStatus(botId, {
        status: 'error',
        lastCheckAt: nowKST(),
        errorMessage: err.message,
        consecutiveErrors,
      });
      fastify.log.error(`[${botId}] 동기화 오류 (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${err.message}`);
      if (consecutiveErrors === 1) {
        logActivity(fastify.db, {
          actor: botId,
          action: 'error',
          category: 'sync',
          summary: `${botId} 동기화 오류: ${err.message}`,
          details: buildErrorDetails(err),
        });
      }
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        fastify.log.warn(`[${botId}] 연속 ${MAX_CONSECUTIVE_ERRORS}회 실패 - 자동 정지`);
        logActivity(fastify.db, {
          actor: botId,
          action: 'stop',
          category: 'bot',
          summary: `${botId} 연속 ${MAX_CONSECUTIVE_ERRORS}회 실패로 자동 정지`,
          details: { ...buildErrorDetails(err), consecutiveErrors },
        });
        // 봇이 멈춘 즉시 폰으로 알림 (조용히 멈춰 며칠 방치되는 것 방지)
        try {
          const name = bot?.channelName || bot?.displayName || bot?.name || bot?.username || botId;
          const { reason, action } = describeBotError(bot, err);
          const pushResult = await sendOpsAlert(fastify.db, {
            title: `봇 정지: ${name}`,
            body: `${reason} — ${action}`,
            data: { botId, kind: 'bot_stopped', reason, rawError: err.message },
          });
          fastify.log.info(`[${botId}] 정지 알림 발송: ${JSON.stringify(pushResult)}`);
        } catch (pushErr) {
          fastify.log.error(`[${botId}] 정지 알림 실패: ${pushErr.message}`);
        }
        try {
          await stopBot(botId);
        } catch (stopErr) {
          fastify.log.error(`[${botId}] 자동 정지 실패: ${stopErr.message}`);
        }
      }
      return { ok: false, err };
    }
  }

  /**
   * 주간 집중 폴링 세션 시작 (weekly 모드)
   * 당일 게시된 일반 영상(그날의 본편)을 저장하면 즉시 종료, durationMinutes 초과 시도 종료.
   * 백로그(지난 날짜) 영상만 추가된 경우에는 계속 폴링한다 — 본편이 몇 분 늦게
   * 올라오는 경우를 놓치지 않기 위함 (2026-07-08 워크돌 미등록 사고 원인).
   */
  async function startWeeklyBurst(botId, bot, syncFn) {
    if (burstTimers.has(botId)) return; // 이미 실행 중이면 무시

    const intervalSeconds = Math.max(5, bot.weeklySchedule?.intervalSeconds || 30);
    const durationMinutes = Math.max(1, bot.weeklySchedule?.durationMinutes || 30);
    const endAt = Date.now() + durationMinutes * 60 * 1000;

    fastify.log.info(`[${botId}] 주간 폴링 시작 (간격 ${intervalSeconds}초, 최대 ${durationMinutes}분)`);

    const stopBurst = (reason) => {
      const handle = burstTimers.get(botId);
      if (!handle) return;
      clearInterval(handle.timer);
      burstTimers.delete(botId);
      fastify.log.info(`[${botId}] 주간 폴링 종료: ${reason}`);
    };

    const tick = async () => {
      if (!burstTimers.has(botId)) return;
      const result = await runSync(botId, bot, syncFn, { setRunningStatus: true });
      if (!burstTimers.has(botId)) return; // runSync 중 자동 정지 등으로 정리됐을 수 있음
      if (result.ok && result.foundTarget) {
        stopBurst('당일 영상 발견 (stopOnFound)');
        return;
      }
      if (Date.now() >= endAt) {
        stopBurst('최대 지속시간 초과');
      }
    };

    // 타이머 먼저 등록 → tick에서 burstTimers.has 체크로 중복/중단 판별
    const timer = setInterval(tick, intervalSeconds * 1000);
    burstTimers.set(botId, { timer, endAt });
    await tick();
  }

  /**
   * 봇 시작
   */
  async function startBot(botId, { runImmediately = true } = {}) {
    const bot = await findBot(botId);
    if (!bot) {
      throw new Error(`봇을 찾을 수 없습니다: ${botId}`);
    }

    // 기존 태스크가 있으면 정지
    if (tasks.has(botId)) {
      tasks.get(botId).stop();
      tasks.delete(botId);
    }
    if (burstTimers.has(botId)) {
      clearInterval(burstTimers.get(botId).timer);
      burstTimers.delete(botId);
    }

    // DB enabled 활성화
    await setEnabled(botId, true);

    const syncFn = getSyncFunction(bot);
    if (!syncFn) {
      throw new Error(`지원하지 않는 봇 타입: ${bot.type}`);
    }

    // cron 태스크 등록 (한국 시간 기준)
    const task = cron.schedule(bot.cron, async () => {
      fastify.log.info(`[${botId}] 동기화 시작`);
      if (bot.weeklySchedule) {
        await startWeeklyBurst(botId, bot, syncFn);
      } else {
        await runSync(botId, bot, syncFn, { setRunningStatus: true });
      }
    }, { timezone: TIMEZONE });

    tasks.set(botId, task);
    // 수동 시작은 새 출발 — 자동 정지로 누적된 연속 실패 카운터/에러 초기화
    await updateStatus(botId, { status: 'running', consecutiveErrors: 0, errorMessage: null });
    fastify.log.info(`[${botId}] 스케줄 시작 (cron: ${bot.cron})`);

    // 즉시 1회 실행: meilisearch와 weekly 모드는 제외 (weekly는 지정 시각에만)
    // runImmediately=false면 생략 (설정 수정에 따른 재시작 등 — 응답 블로킹 방지)
    if (runImmediately && bot.type !== 'meilisearch' && !bot.weeklySchedule) {
      await runSync(botId, bot, syncFn, { setRunningStatus: false });
    }
  }

  /**
   * 봇 정지
   */
  async function stopBot(botId) {
    if (tasks.has(botId)) {
      tasks.get(botId).stop();
      tasks.delete(botId);
    }
    // weekly 모드 burst 타이머도 정리
    if (burstTimers.has(botId)) {
      clearInterval(burstTimers.get(botId).timer);
      burstTimers.delete(botId);
    }
    // DB enabled 비활성화
    await setEnabled(botId, false);
    await updateStatus(botId, { status: 'stopped' });
    fastify.log.info(`[${botId}] 스케줄 정지`);
  }

  /**
   * 모든 활성 봇 시작
   */
  async function startAll() {
    const allBots = await getAllBots(true); // DB에서 새로 로드
    for (const bot of allBots) {
      if (bot.enabled) {
        try {
          await startBot(bot.id);
        } catch (err) {
          fastify.log.error(`[${bot.id}] 시작 실패: ${err.message}`);
        }
      }
    }

  }

  /**
   * 모든 봇 정지
   */
  async function stopAll() {
    for (const [botId, task] of tasks) {
      task.stop();
      await updateStatus(botId, { status: 'stopped' });
    }
    tasks.clear();
  }

  /**
   * 봇 캐시 갱신 (봇 추가/수정/삭제 시 호출)
   */
  function invalidateCache() {
    cachedBots = null;
  }

  // 예정(임시) 일정 deadline 체크 — 매일 00:05 KST
  // syncNewVideos 내부 체크는 weekly 봇에서 실행될 기회가 없으므로 별도 cron으로 보장
  cron.schedule('5 0 * * *', async () => {
    try {
      const youtubeBots = await getYouTubeBotsFromDB();
      for (const bot of youtubeBots) {
        if (bot.enabled && bot.autoScheduleNext) {
          await fastify.youtubeBot.checkScheduledDeadline(bot);
        }
      }
    } catch (err) {
      fastify.log.error(`예정 일정 deadline 체크 실패: ${err.message}`);
    }
  }, { timezone: TIMEZONE });

  // 데코레이터 등록
  fastify.decorate('scheduler', {
    startBot,
    stopBot,
    startAll,
    stopAll,
    getStatus,
    getBots: (forceRefresh = false) => getAllBots(forceRefresh),
    invalidateCache,
  });

  // 앱 종료 시 모든 봇 정지
  fastify.addHook('onClose', async () => {
    await stopAll();
    fastify.log.info('모든 봇 스케줄 정지');
  });
}

export default fp(schedulerPlugin, {
  name: 'scheduler',
  dependencies: ['db', 'redis', 'meilisearch', 'youtubeBot', 'xBot', 'festivalBot'],
});
