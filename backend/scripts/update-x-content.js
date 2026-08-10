/**
 * 기존 X 트윗의 content를 Nitter에서 다시 가져와서 원본 URL로 업데이트
 */
import mysql from 'mysql2/promise';

const NITTER_URL = process.env.NITTER_URL || 'http://nitter:8080';
const USERNAME = 'realfromis_9';

// DB 연결
const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

/**
 * 트윗 HTML 컨텐츠에서 텍스트 추출 (링크는 원본 URL 사용)
 */
function extractTextFromHtml(html) {
  return html
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g, (match, href, text) => {
      if (href.startsWith('/')) {
        return text;
      }
      return href;
    })
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Nitter에서 단일 트윗 조회
 */
async function fetchTweetContent(postId) {
  const url = `${NITTER_URL}/${USERNAME}/status/${postId}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`트윗을 찾을 수 없습니다 (${res.status})`);
  }

  const html = await res.text();

  const mainTweetMatch = html.match(/<div id="m" class="main-tweet">([\s\S]*?)<div id="r" class="replies">/);
  if (!mainTweetMatch) {
    throw new Error('트윗 내용을 파싱할 수 없습니다');
  }

  const container = mainTweetMatch[1];
  const contentMatch = container.match(/<div class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);

  if (!contentMatch) {
    throw new Error('트윗 컨텐츠를 찾을 수 없습니다');
  }

  return extractTextFromHtml(contentMatch[1]);
}

// 메인 실행
async function main() {
  console.log('X 트윗 content 업데이트 시작...\n');

  // schedule_x에서 모든 트윗 가져오기
  const [rows] = await db.query(`
    SELECT sx.schedule_id, sx.post_id, sx.content
    FROM schedule_x sx
    ORDER BY sx.schedule_id DESC
  `);

  console.log(`총 ${rows.length}개의 트윗을 확인합니다.\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const { schedule_id, post_id, content } = row;

    // 축약된 URL이 있는지 확인 (…로 끝나는 패턴)
    if (!content || !content.includes('…')) {
      skipped++;
      continue;
    }

    console.log(`[${schedule_id}] post_id: ${post_id} - 업데이트 중...`);

    try {
      const newContent = await fetchTweetContent(post_id);

      // content가 변경되었는지 확인
      if (newContent !== content) {
        await db.query(
          'UPDATE schedule_x SET content = ? WHERE schedule_id = ?',
          [newContent, schedule_id]
        );
        console.log(`  ✓ 업데이트 완료`);
        updated++;
      } else {
        console.log(`  - 변경 없음`);
        skipped++;
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.log(`  ✗ 오류: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n완료!`);
  console.log(`  업데이트: ${updated}개`);
  console.log(`  스킵: ${skipped}개`);
  console.log(`  오류: ${errors}개`);

  await db.end();
}

main().catch(console.error);
