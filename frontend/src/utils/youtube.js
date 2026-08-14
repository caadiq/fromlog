/**
 * YouTube 관련 유틸리티 함수
 */

/**
 * YouTube URL에서 비디오 ID 추출
 * @param {string} url - YouTube URL
 * @returns {string|null} 비디오 ID 또는 null
 */
export function getYoutubeVideoId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * 썸네일 규격 선택 — 비율이 카드와 같은 것만 쓴다.
 *
 * 유튜브 썸네일은 규격마다 비율이 다르고, **4:3 규격은 영상 위아래(또는 세로 영상이면 좌우)에
 * 검은 여백이 이미지 안에 그려져 있다.**
 *   16:9 (여백 없음) : mqdefault 320x180, hq720·maxresdefault 1280x720
 *   4:3  (여백 있음) : default 120x90, hqdefault 480x360, sddefault 640x480
 *
 * 4:3짜리를 16:9 카드에 object-cover로 넣으면 그 여백이 잘려나가도록 계산되는데,
 * 크롭 폭이 소수(예: 25.64px)라 브라우저가 물리 픽셀에 그릴 때 반올림하면서 1~2px이 남는다.
 * 카드의 top/left가 소수면 줄·열마다 반올림 방향이 달라져, **한 줄은 위에 한 줄은 아래에**
 * 검은 선이 보이는 현상이 된다(실제로 겪음).
 *
 * 그래서 비율이 같은 규격을 쓴다 — 크롭할 게 없으면 반올림해도 남을 여백이 없다.
 */
const THUMB = (id, kind) => `https://img.youtube.com/vi/${id}/${kind}.jpg`;

/** 가로(16:9) 카드용 — 고화질 우선 */
export const wideThumb = (id) => THUMB(id, 'maxresdefault');

/** 세로(9:16) 쇼츠 카드용 — 원본 비율 그대로인 규격 */
export const shortsThumb = (id) => THUMB(id, 'oardefault');

/**
 * 가로 썸네일 폴백 — maxresdefault가 없는 영상은 mqdefault로.
 * 둘 다 16:9라 어느 쪽으로 떨어져도 검은 여백이 없다.
 */
export function onWideThumbError(e, id) {
  const el = e.currentTarget;
  if (!el.src.includes('mqdefault')) el.src = THUMB(id, 'mqdefault');
}

/**
 * 쇼츠 썸네일 폴백.
 *
 * oardefault가 없는 영상은 404 대신 **120x90 회색 플레이스홀더**가 200으로 오므로
 * onError가 아니라 로드된 크기로 판별한다.
 * 폴백으로 갈 수 있는 건 4:3짜리뿐이라(세로 영상이면 좌우에 검은 여백) 여백이 남는다.
 * 이때만 살짝 확대해 여백을 화면 밖으로 밀어낸다 — 1~2px 때문에 2%면 충분하다.
 */
export function onShortsThumbLoad(e, id) {
  const el = e.currentTarget;
  if (el.naturalWidth <= 120 && !el.src.includes('hqdefault')) {
    el.src = THUMB(id, 'hqdefault');
    el.classList.add('scale-[1.02]');
  }
}

/** 쇼츠 썸네일이 아예 404인 경우 */
export function onShortsThumbError(e, id) {
  const el = e.currentTarget;
  if (!el.src.includes('hqdefault')) {
    el.src = THUMB(id, 'hqdefault');
    el.classList.add('scale-[1.02]');
  }
}

