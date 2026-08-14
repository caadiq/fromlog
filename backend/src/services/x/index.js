import fp from 'fastify-plugin';
import { fetchTweets, fetchAllTweets, fetchProfile as fetchNitterProfile, extractTitle, extractYoutubeVideoIds } from './scraper.js';
import { fetchOgCard, extractFirstUrl } from './og.js';
import { fetchVideoInfo } from '../youtube/api.js';
import { archiveVideo } from '../videos.js';
import { loadSongTitles, classifyMusicTitle } from '../videoCategory.js';
import { formatDate, formatTime, nowKST } from '../../utils/date.js';
import { withTransaction } from '../../utils/transaction.js';
import { syncScheduleById } from '../meilisearch/index.js';
import { logActivity } from '../../utils/log.js';
import { CATEGORY_IDS } from '../../config/index.js';
import { getManagedChannelIds } from '../../utils/bots.js';
import { promoteTempSchedule } from '../../utils/tempSchedule.js';

const PROFILE_CACHE_PREFIX = 'x_profile:';
const PROFILE_TTL = 604800; // 7일

async function xBotPlugin(fastify, opts) {
  /**
   * X 프로필 저장 (bot_x 테이블 + Redis 캐시)
   */
  async function saveProfile(username, profile) {
    if (!profile.displayName && !profile.avatarUrl) return;

    // bot_x 테이블 업데이트
    await fastify.db.query(`
      UPDATE bot_x SET display_name = ?, avatar_url = ?
      WHERE username = ?
    `, [profile.displayName, profile.avatarUrl, username]);

    // Redis 캐시에도 저장
    const data = {
      username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      updatedAt: nowKST(),
    };
    await fastify.redis.setex(
      `${PROFILE_CACHE_PREFIX}${username}`,
      PROFILE_TTL,
      JSON.stringify(data)
    );
  }

  /**
   * 트윗을 DB에 저장
   */
  /**
   * 트윗 카드 확정
   * - Nitter가 준 카드가 유효(제목/이미지 보유)하면 그대로 사용
   * - 비었거나 없으면 본문 첫 URL로 OG 직접 추출 (YouTube 등 복구)
   */
  async function resolveCard(tweet) {
    const nitter = tweet.card && (tweet.card.title || tweet.card.image) ? tweet.card : null;

    // pbs.twimg.com/card_img 이미지는 시간이 지나면 만료(404)되므로 안정적인 원본 OG 이미지로 대체.
    // 이미지가 없거나 만료성 트위터 카드 이미지면 OG 보강 시도.
    const isEphemeral = nitter?.image && /pbs\.twimg\.com\/card_img\//.test(nitter.image);
    const needsImage = !nitter || !nitter.image || isEphemeral;

    if (needsImage) {
      const url = (nitter && nitter.url) || extractFirstUrl(tweet.text);
      // TikTok은 OG 이미지를 막으므로 oEmbed 썸네일을 온디맨드 프록시 경로로 제공 (만료 URL이라 저장 안 함)
      if (url && /tiktok\.com/.test(url)) {
        const image = `/api/schedules/x-card-thumb/${tweet.id}`;
        return nitter
          ? { ...nitter, image }
          : { url, title: '', description: '', destination: 'tiktok.com', image };
      }
      if (url) {
        try {
          const og = await fetchOgCard(url);
          if (og && og.image) {
            return nitter
              ? { ...nitter, image: og.image, description: nitter.description || og.description }
              : og;
          }
          // OG 이미지가 없고 Nitter 카드도 없으면 OG 카드라도 반환
          if (og && !nitter) return og;
        } catch {
          // noop
        }
      }
    }
    return nitter;
  }

  async function saveTweet(tweet, username) {
    // 중복 체크 (post_id로) - 트랜잭션 전에 수행
    const [existing] = await fastify.db.query(
      'SELECT id FROM schedule_x WHERE post_id = ?',
      [tweet.id]
    );
    if (existing.length > 0) {
      return null;
    }

    // 리트윗 이중 저장 방지: 같은 리트윗이 타임라인에서 래퍼 id / 원본 id 두 형태로
    // 번갈아 나타나 post_id가 달라도 같은 트윗인 경우가 있음.
    // hydration으로 양쪽 모두 전체 내용을 갖추므로 동일 내용이면 중복 처리.
    // username은 형태에 따라 원작자/봇계정으로 불일치할 수 있어 둘 다 매칭.
    if (tweet.isRetweet && tweet.text) {
      const [dup] = await fastify.db.query(
        'SELECT id FROM schedule_x WHERE content = ? AND username IN (?, ?) LIMIT 1',
        [tweet.text, tweet.originalUsername || username, username]
      );
      if (dup.length > 0) {
        return null;
      }
    }

    const date = formatDate(tweet.time);
    const time = formatTime(tweet.time);
    const title = extractTitle(tweet.text);

    // 리트윗인 경우 원본 작성자를 username으로 사용
    const tweetUsername = tweet.originalUsername || username;

    // 카드 확정: Nitter 카드 우선, 비어있으면 본문 URL로 OG 직접 추출 (fallback)
    const card = await resolveCard(tweet);

    // 트랜잭션으로 INSERT 작업 수행
    return withTransaction(fastify.db, async (connection) => {
      // schedules 테이블에 저장
      const [result] = await connection.query(
        'INSERT INTO schedules (category_id, title, date, time) VALUES (?, ?, ?, ?)',
        [CATEGORY_IDS.X, title, date, time]
      );
      const scheduleId = result.insertId;

      // schedule_x 테이블에 저장
      await connection.query(
        'INSERT INTO schedule_x (schedule_id, post_id, username, content, image_urls, video_thumbnails, card_data) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          scheduleId,
          tweet.id,
          tweetUsername,
          tweet.text,
          tweet.imageUrls.length > 0 ? JSON.stringify(tweet.imageUrls) : null,
          tweet.videoThumbnails?.length > 0 ? JSON.stringify(tweet.videoThumbnails) : null,
          card ? JSON.stringify(card) : null,
        ]
      );

      return scheduleId;
    });
  }

  /**
   * YouTube 영상을 DB에 저장 (트윗에서 감지된 링크)
   */
  async function saveYoutubeFromTweet(video) {
    // 중복 체크 - 트랜잭션 전에 수행
    const [existing] = await fastify.db.query(
      'SELECT id FROM schedule_youtube WHERE video_id = ?',
      [video.videoId]
    );
    if (existing.length > 0) {
      return null;
    }

    // 큐에서 등록한 예정 일정이 이 영상을 기다리고 있으면 새로 만들지 않고 채운다.
    // (예정 일정은 video_id가 비어 있어 위의 중복 체크로는 안 걸린다 — 그냥 두면 같은 회차가 두 개 생긴다)
    const promoted = await promoteTempSchedule(fastify.db, {
      videoId: video.videoId,
      videoType: video.videoType,
      channelId: video.channelId,
      channelName: video.channelTitle,
      title: video.title,
      date: video.date,
      time: video.time,
    });
    if (promoted) {
      fastify.log.info(`[x] 예정 일정 승격: ${video.title}`);
      return promoted;
    }

    // 트랜잭션으로 INSERT 작업 수행
    try {
      return await withTransaction(fastify.db, async (connection) => {
        // schedules 테이블에 저장
        const [result] = await connection.query(
          'INSERT INTO schedules (category_id, title, date, time) VALUES (?, ?, ?, ?)',
          [CATEGORY_IDS.YOUTUBE, video.title, video.date, video.time]
        );
        const scheduleId = result.insertId;

        // schedule_youtube 테이블에 저장
        await connection.query(
          'INSERT INTO schedule_youtube (schedule_id, video_id, video_type, channel_id, channel_name) VALUES (?, ?, ?, ?, ?)',
          [scheduleId, video.videoId, video.videoType, video.channelId, video.channelTitle]
        );

        return scheduleId;
      });
    } catch (err) {
      // UNIQUE 제약 위반 (동시성 중복) → 무시
      if (err.code === 'ER_DUP_ENTRY') return null;
      throw err;
    }
  }

  /**
   * 트윗에서 YouTube 링크 처리
   */
  async function processYoutubeLinks(tweet, { excludeManagedChannels = true } = {}) {
    const videoIds = extractYoutubeVideoIds(tweet.text);
    if (videoIds.length === 0) return 0;

    const managedChannels = excludeManagedChannels ? await getManagedChannelIds(fastify.db) : [];
    let addedCount = 0;

    for (const videoId of videoIds) {
      try {
        const video = await fetchVideoInfo(videoId);
        if (!video) continue;

        // 옵션에 따라 관리 중인 채널 영상은 스킵
        if (excludeManagedChannels && managedChannels.includes(video.channelId)) continue;

        // 영상 아카이브 적재 — 봇 미등록 채널이므로 제목 판별로 무대/기타를 가른다
        // (무대·직캠 영상이 트윗으로 발견되는 경우가 있어 전부 '기타'로 넣으면 안 됨)
        const songs = await loadSongTitles(fastify.db);
        await archiveVideo(fastify.db, {
          videoId: video.videoId,
          channelId: video.channelId,
          channelName: video.channelTitle,
          title: video.title,
          category: classifyMusicTitle(video.title, songs),
          videoType: video.videoType,
          publishedAt: `${video.date} ${video.time}`, // formatDate/formatTime — KST YYYY-MM-DD HH:mm:ss
        });

        const scheduleId = await saveYoutubeFromTweet(video);
        if (scheduleId) {
          // Meilisearch 동기화
          await syncScheduleById(fastify.meilisearch, fastify.db, scheduleId, fastify.redis);
          addedCount++;
        }
      } catch (err) {
        fastify.log.error(`YouTube 영상 처리 오류 (${videoId}): ${err.message}`);
      }
    }

    return addedCount;
  }

  /**
   * 텍스트 필터 적용 (키워드 중 하나라도 포함되면 true)
   */
  function matchesFilter(text, filters) {
    if (!filters || filters.length === 0) return true;
    const lowerText = text.toLowerCase();
    return filters.some(filter => lowerText.includes(filter.toLowerCase()));
  }

  /**
   * 최근 트윗 동기화 (정기 실행)
   */
  async function syncNewTweets(bot) {
    const options = { includeRetweets: bot.includeRetweets || false, log: fastify.log };
    const { tweets, profile } = await fetchTweets(bot.nitterUrl, bot.username, options);

    // 프로필 저장 (DB + 캐시)
    await saveProfile(bot.username, profile);

    // 멤버 추출 옵션이 켜져 있으면 이름 맵 준비

    let addedCount = 0;
    let ytAddedCount = 0;

    for (const tweet of tweets) {
      // 텍스트 필터 적용
      if (!matchesFilter(tweet.text, bot.textFilters)) {
        continue;
      }

      const scheduleId = await saveTweet(tweet, bot.username);
      if (scheduleId) {
        // Meilisearch 동기화
        await syncScheduleById(fastify.meilisearch, fastify.db, scheduleId, fastify.redis);
        const title = extractTitle(tweet.text);
        logActivity(fastify.db, {
          actor: bot.id,
          action: 'create',
          category: 'schedule',
          targetType: 'x_schedule',
          targetId: scheduleId,
          summary: `X 트윗 추가: ${title}`,
        });
        addedCount++;
        // YouTube 링크 처리 (옵션이 켜져 있을 때만)
        if (bot.extractYoutube === true) {
          ytAddedCount += await processYoutubeLinks(tweet, {
            excludeManagedChannels: bot.excludeManagedChannels !== false,
          });
        }
      }
    }

    return { addedCount: addedCount + ytAddedCount, total: tweets.length, tweetCount: addedCount, ytCount: ytAddedCount };
  }

  /**
   * 전체 트윗 동기화 (초기화)
   */
  async function syncAllTweets(bot) {
    const options = { includeRetweets: bot.includeRetweets || false };
    const tweets = await fetchAllTweets(bot.nitterUrl, bot.username, fastify.log, options);


    let addedCount = 0;
    let ytAddedCount = 0;

    for (const tweet of tweets) {
      // 텍스트 필터 적용
      if (!matchesFilter(tweet.text, bot.textFilters)) {
        continue;
      }

      const scheduleId = await saveTweet(tweet, bot.username);
      if (scheduleId) {
        // Meilisearch 동기화
        await syncScheduleById(fastify.meilisearch, fastify.db, scheduleId, fastify.redis);
        addedCount++;
        // YouTube 링크 처리 (옵션이 켜져 있을 때만)
        if (bot.extractYoutube === true) {
          ytAddedCount += await processYoutubeLinks(tweet, {
            excludeManagedChannels: bot.excludeManagedChannels !== false,
          });
        }
      }
    }

    return { addedCount: addedCount + ytAddedCount, total: tweets.length, tweetCount: addedCount, ytCount: ytAddedCount };
  }

  /**
   * X 프로필 조회 (Redis 캐시 → bot_x 테이블 → Nitter 직접 조회)
   */
  async function getProfile(username) {
    // Redis 캐시 확인
    const cached = await fastify.redis.get(`${PROFILE_CACHE_PREFIX}${username}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // bot_x 테이블에서 조회
    const [rows] = await fastify.db.query(
      'SELECT username, display_name, avatar_url FROM bot_x WHERE username = ?',
      [username]
    );

    if (rows.length > 0) {
      const row = rows[0];
      const data = {
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
      };
      await fastify.redis.setex(
        `${PROFILE_CACHE_PREFIX}${username}`,
        PROFILE_TTL,
        JSON.stringify(data)
      );
      return data;
    }

    // bot_x에 없으면 Nitter에서 직접 조회 (리트윗 원본 작성자 등)
    try {
      const nitterUrl = fastify.config?.nitter?.url || process.env.NITTER_URL || 'http://nitter:8080';
      const profile = await fetchNitterProfile(nitterUrl, username);
      if (profile) {
        const data = {
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
        };
        // Redis 캐시에 저장
        await fastify.redis.setex(
          `${PROFILE_CACHE_PREFIX}${username}`,
          PROFILE_TTL,
          JSON.stringify(data)
        );
        return data;
      }
    } catch (err) {
      fastify.log.error(`Nitter 프로필 조회 실패 (${username}): ${err.message}`);
    }

    return null;
  }

  fastify.decorate('xBot', {
    syncNewTweets,
    syncAllTweets,
    getProfile,
  });
}

export default fp(xBotPlugin, {
  name: 'xBot',
  dependencies: ['db', 'redis'],
});
