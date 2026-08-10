/**
 * 활동 로그 상수 및 유틸리티
 */

// 카테고리 한글 라벨 매핑
export const CATEGORY_LABELS = {
  album: '앨범',
  schedule: '일정',
  member: '멤버',
  bot: '봇',
  category: '카테고리',
  dict: '사전',
  concert: '콘서트',
  sync: '동기화',
};

// 액션 뱃지 색상 (에디토리얼 플랫 톤)
export const ACTION_STYLES = {
  create: 'bg-green-soft text-green-deep',
  upload: 'bg-green-soft text-green-deep',
  update: 'bg-[#EAF0F7] text-[#3D6291]',
  delete: 'bg-[#F9E9E7] text-[#C0392B]',
  sync_complete: 'bg-[#F0EBF7] text-[#6B4FA1]',
  error: 'bg-[#F9E9E7] text-[#C0392B]',
  start: 'bg-[#FBF6E4] text-[#8A6D1B]',
  stop: 'bg-[#FBF6E4] text-[#8A6D1B]',
};

// 액션 한글 라벨
export const ACTION_LABELS = {
  create: '생성',
  upload: '업로드',
  update: '수정',
  delete: '삭제',
  sync_complete: '동기화',
  error: '에러',
  start: '시작',
  stop: '정지',
};

export const ITEMS_PER_PAGE = 15;

// HTML 엔티티 디코딩
export function decodeHtml(str) {
  if (!str) return '';
  const el = document.createElement('textarea');
  el.innerHTML = str;
  return el.value;
}

// summary를 prefix와 detail로 분리
export function parseSummary(summary) {
  const decoded = decodeHtml(summary);
  const idx = decoded.indexOf(': ');
  if (idx === -1) return { prefix: decoded, detail: '' };
  return { prefix: decoded.substring(0, idx), detail: decoded.substring(idx + 2) };
}

// 날짜/시간 포맷 (DB에 KST로 저장되어 있으므로 UTC 기준으로 읽음)
export function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  const y = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${y}.${month}.${day} ${hours}:${minutes}`;
}

// details가 유효한 데이터인지 확인
export function hasDetails(details) {
  return details && typeof details === 'object' && Object.keys(details).length > 0;
}
