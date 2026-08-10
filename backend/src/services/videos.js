/**
 * 영상 아카이브 서비스 (videos 테이블)
 * 일정과 분리된 영상 페이지 데이터원. 봇 sync·백필·수동 등록이 공통으로 사용.
 */

import { refineCategory, loadSongTitles, classifyMusicTitle } from './videoCategory.js';

/** 멤버 이름 매칭 테이블 (한글·영문 표기) */
const MEMBER_PATTERNS = [
  { name: '송하영', patterns: ['송하영', '하영', 'hayoung', 'ha young'] },
  { name: '박지원', patterns: ['박지원', '지원', 'jiwon', 'ji won'] },
  { name: '이채영', patterns: ['이채영', '채영', 'chaeyoung', 'chae young'] },
  { name: '이나경', patterns: ['이나경', '나경', 'nagyung', 'na gyung', 'nakyung'] },
  { name: '백지헌', patterns: ['백지헌', '지헌', 'jiheon', 'ji heon'] },
];

/**
 * 직캠 제목에서 멤버 태그 추출
 * @returns {string[]} 매칭 멤버 이름 목록 (빈 배열 = 단체)
 */
export function tagFancamMembers(title) {
  const t = String(title || '').normalize('NFC').toLowerCase();
  const tagged = [];
  for (const m of MEMBER_PATTERNS) {
    if (m.patterns.some((p) => t.includes(p))) tagged.push(m.name);
  }
  return tagged;
}

/**
 * 채널·제목으로 카테고리 추론 (수동 등록·백필용)
 * 봇 채널이면 봇의 분류, 아니면 제목의 직캠 표기로 판별, 기본 variety.
 */
export async function inferCategory(db, channelId, title) {
  if (channelId) {
    const [bots] = await db.query(
      'SELECT video_category FROM bot_youtube WHERE channel_id = ?',
      [channelId]
    );
    if (bots.length > 0) {
      return refineCategory(db, bots[0].video_category || 'variety', title);
    }
  }
  // 봇 미등록 채널 — 제목 판별로 무대/기타를 가른다 (X봇 발견 영상과 동일 규칙)
  const songs = await loadSongTitles(db);
  return classifyMusicTitle(title, songs);
}

/**
 * 영상 아카이브 하한 — 5인 체제 시작일
 * 사이트는 5인 체제 콘텐츠만 담는다. 백필 재실행이나 봇이 과거 영상을
 * 만나도 이 날짜 이전 업로드는 적재하지 않는다 (cleanup-5member-era.mjs 참고).
 */
export const ARCHIVE_MIN_DATE = '2025-01-26';

/**
 * 영상 아카이브 적재 (중복 video_id는 무시)
 * @param {object} db
 * @param {object} v - { videoId, channelId, channelName, title, category, videoType, publishedAt }
 * @returns {Promise<boolean>} 새로 적재됐으면 true
 */
export async function archiveVideo(db, v) {
  if (String(v.publishedAt) < ARCHIVE_MIN_DATE) return false;
  const members =
    v.category === 'music' ? JSON.stringify(tagFancamMembers(v.title)) : null;
  const [result] = await db.query(
    `INSERT IGNORE INTO videos
       (video_id, channel_id, channel_name, title, category, video_type, duration, published_at, members)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      v.videoId,
      v.channelId,
      v.channelName || null,
      v.title,
      v.category,
      v.videoType || 'video',
      v.duration ?? null,
      v.publishedAt,
      members,
    ]
  );
  return result.affectedRows > 0;
}
