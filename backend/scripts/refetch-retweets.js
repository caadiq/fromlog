/**
 * 리트윗 데이터 재수집 스크립트
 * 원본 작성자의 타임라인에서 매칭되는 트윗을 찾아 이미지와 내용을 복구합니다.
 *
 * 사용법: node scripts/refetch-retweets.js [scheduleId1,scheduleId2,...]
 */
import mysql from 'mysql2/promise';
import { fetchAllTweets, fetchSingleTweet, extractTitle } from '../src/services/x/scraper.js';

const NITTER_URL = process.env.NITTER_URL || 'http://nitter:8080';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mariadb',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'fromlog',
  password: process.env.DB_PASSWORD || 'fromis9',
  database: process.env.DB_NAME || 'fromlog',
});

// 간단한 로거
const log = {
  info: (msg) => console.log(msg),
  error: (msg) => console.error(msg),
};

// 타임라인 캐시 (같은 작성자의 반복 조회 방지)
const timelineCache = new Map();

/**
 * 원본 작성자의 타임라인에서 매칭되는 트윗 찾기
 */
async function findOriginalTweet(username, content, date) {
  // 캐시 확인
  if (!timelineCache.has(username)) {
    console.log(`  @${username} 타임라인 수집 중...`);
    const tweets = await fetchAllTweets(NITTER_URL, username, log, { includeRetweets: false });
    timelineCache.set(username, tweets);
    console.log(`  -> ${tweets.length}개 트윗 수집 완료`);
  }

  const tweets = timelineCache.get(username);

  // 내용의 첫 30자로 매칭 (완전 일치는 포맷 차이로 어려움)
  const contentStart = content.substring(0, 30).trim();

  for (const tweet of tweets) {
    if (tweet.text.startsWith(contentStart)) {
      return tweet;
    }
  }

  // 날짜 기반 유사 매칭 시도
  const targetDate = date?.split('T')[0];
  if (targetDate) {
    for (const tweet of tweets) {
      const tweetDate = tweet.time?.toISOString().split('T')[0];
      if (tweetDate === targetDate && tweet.text.includes(contentStart.substring(0, 15))) {
        return tweet;
      }
    }
  }

  return null;
}

async function main() {
  const argIds = process.argv[2]?.split(',').map(Number).filter(Boolean);

  let rows;
  if (argIds && argIds.length > 0) {
    [rows] = await pool.query(
      `SELECT sx.schedule_id, sx.post_id, sx.username, sx.content, sx.image_urls, s.date
       FROM schedule_x sx JOIN schedules s ON sx.schedule_id = s.id
       WHERE sx.schedule_id IN (?)`,
      [argIds]
    );
  } else {
    // 이미지가 없는 리트윗 또는 content에 문제가 있는 것
    [rows] = await pool.query(
      `SELECT sx.schedule_id, sx.post_id, sx.username, sx.content, sx.image_urls, s.date
       FROM schedule_x sx JOIN schedules s ON sx.schedule_id = s.id
       WHERE sx.content LIKE 'RT @%'
          OR sx.content LIKE '%nitter%t.co%'
          OR (sx.image_urls IS NULL AND sx.username != 'realfromis_9')`
    );
  }

  console.log(`대상: ${rows.length}건\n`);
  if (rows.length === 0) {
    await pool.end();
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const username = row.username || 'realfromis_9';
      console.log(`[${row.schedule_id}] @${username} post_id=${row.post_id}`);

      // 1단계: 먼저 개별 페이지에서 시도 (RT prefix 제거)
      let newContent = row.content || '';
      let newImageUrls = null;
      let newPostId = row.post_id;

      // RT @ 프리픽스가 있으면 제거
      const rtPrefixMatch = newContent.match(/^RT @\w+:\s*/);
      if (rtPrefixMatch) {
        newContent = newContent.slice(rtPrefixMatch[0].length);
      }
      newContent = newContent.replace(/…$/, '').trim();

      // nitter t.co 링크 수정
      newContent = newContent.replace(/https?:\/\/nitter[^/]*\/t\.co\/(\S+)/g, 'https://t.co/$1');

      // 2단계: 이미지가 없으면 원본 작성자 타임라인에서 찾기
      if (!row.image_urls) {
        const original = await findOriginalTweet(username, newContent, row.date);
        if (original) {
          newContent = original.text;
          newPostId = original.id;
          if (original.imageUrls.length > 0) {
            newImageUrls = JSON.stringify(original.imageUrls);
          }
          console.log(`  -> 원본 발견! id=${original.id}, images=${original.imageUrls.length}`);
        } else {
          console.log(`  -> 원본 미발견, 텍스트만 수정`);
        }
      }

      const newTitle = extractTitle(newContent);

      // DB 업데이트
      await pool.query('UPDATE schedules SET title = ? WHERE id = ?', [newTitle, row.schedule_id]);
      await pool.query(
        'UPDATE schedule_x SET post_id = ?, username = ?, content = ?, image_urls = ? WHERE schedule_id = ?',
        [newPostId, username, newContent, newImageUrls, row.schedule_id]
      );

      console.log(`  -> title: ${newTitle.substring(0, 60)} | images: ${newImageUrls ? JSON.parse(newImageUrls).length : 0}`);
      updated++;
    } catch (err) {
      console.error(`  -> 실패: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n완료: ${updated}건 수정, ${failed}건 실패`);
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
