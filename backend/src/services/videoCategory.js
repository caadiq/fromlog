/**
 * 음방 채널 영상의 무대/예능 판별
 *
 * 음방·직캠 채널(엠카, 뮤뱅, 인가, 음중, STUDIO CHOOM 등)은 무대 영상만 올리는 게
 * 아니라 자체 예능·라디오·챌린지도 함께 올린다. 채널만 보고 전부 '음방'으로 넣으면
 * 「더 시즌즈」 토크나 「체아빙」 같은 예능이 음방에 섞인다.
 *
 * 코너명은 계속 새로 생기므로 예능 키워드를 하나씩 빼는 방식은 계속 샌다.
 * 반대로 무대·직캠·라이브는 예외 없이 제목에 곡명이 들어가므로, 곡명 사전(album_tracks)
 * 매칭을 1차 신호로 쓰고 직캠·안무·시상식 표기를 2차 신호로 보완한다.
 */

/**
 * 무대·퍼포먼스 표기 (곡명이 안 잡혀도 무대로 인정)
 *
 * '무대'는 단독으로 쓰지 않는다 — "무대 찢고" 같은 비유 표현에 걸린다.
 * 실제 무대 영상은 곡명·직캠·프로그램 제목 구조로 이미 잡히므로,
 * 여기서는 문자 그대로의 복합어(컴백 무대·무대 영상 등)만 본다.
 */
const STAGE_RE =
  /직캠|fancam|풀캠|fullcam|페이스캠|얼빡|포커스캠|unfiltered ?cam|full ?focused|be ?original|k-?choreo|교차편집|stage ?mix|릴레이 ?댄스|릴댄|안무 ?영상|안무 ?ver|choreograph|dance ?practice|컴백 ?무대|데뷔 ?무대|특별 ?무대|엔딩 ?무대|합동 ?무대|첫 ?무대|무대 ?영상|무대 ?모음|1위|앵콜|encore|킬링파트|killing ?part|모아보기|몰아보기|compilation|\.zip/i;

/**
 * 예능·부가 콘텐츠 (곡명이 있어도 무대가 아님 — 최우선 적용)
 *
 * 뒷줄은 노래를 부르지만 음악방송 무대가 아닌 라이브·라디오 코너들이다.
 * 이걸 음방에 넣으면 같은 시리즈가 곡명 유무에 따라 두 카테고리로 쪼개진다.
 */
const NOT_STAGE_RE = new RegExp(
  [
    'behind|비하인드|메이킹|making|챌린지|challenge|셀프캠|selfie|self ?cam',
    '인사 ?메시지|greeting|포토이즘|미니게임|tmi|먹방|브이로그|vlog',
    '리무진 ?서비스|라디오|radio|잇츠라이브|it’?s ?live|초대석|live ?class|킬링 ?보이스|killing ?voice',
    // 제목 끝에 곡 태그가 붙는 예능 코너 — 곡명 신호보다 우선해야 한다
    '매터돌|snack ?spree|너너댄스',
  ].join('|'),
  'i'
);

/**
 * 무대 제목 구조 — "프로미스나인 - 곡명 [프로그램]" 또는 "곡명 - 프로미스나인 [프로그램]"
 * 커버곡·축제 무대처럼 곡명 사전에 없는 경우를 이 형식으로 건진다.
 * 프로그램명(엠카운트다운 등)을 키워드로 쓰면 그 채널의 예능까지 딸려오므로 형식으로만 본다.
 */
const ARTIST_SONG_RE =
  /(?:fromis_?9|프로미스나인)\s*(?:\([^)]*\))?\s*[-–—]\s*\S|[-–—]\s*(?:fromis_?9|프로미스나인)/i;

const WORD_CHAR = /[0-9a-z가-힣]/;

let cache = { at: 0, songs: [] };
const CACHE_MS = 10 * 60 * 1000;

/** NFKC — 전각 문자(＃menow)·장식 유니코드(𝑶𝑶𝑻𝑴)를 일반 문자로 되돌린다 */
function normalize(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase();
}

/** 앨범 수록곡 제목 목록 (10분 캐시) */
export async function loadSongTitles(db) {
  const now = Date.now();
  if (cache.songs.length > 0 && now - cache.at < CACHE_MS) return cache.songs;
  const [rows] = await db.query('SELECT DISTINCT title FROM album_tracks');
  const songs = [
    ...new Set(rows.map((r) => normalize(r.title).trim()).filter((s) => s.length >= 2)),
  ];
  cache = { at: now, songs };
  return songs;
}

/** 캐시 무효화 (곡 추가/수정 후) */
export function clearSongCache() {
  cache = { at: 0, songs: [] };
}

/**
 * 제목이 곡을 지칭하는가
 *
 * 곡명이 단어 중간에 우연히 걸리는 걸 막아야 한다. "fromis_9"에는 곡 'from'이,
 * "HERE WE GO"에는 곡 'WE GO'가 들어 있다. 그래서 앞뒤가 모두 단어 문자가 아니어야 하고,
 * 공백을 건너뛴 바로 앞 문자도 단어 문자면 안 된다 (HERE ↔ WE GO).
 * 뒤쪽은 문자 종류가 바뀌는 경우만 허용한다 ("Vitamin ME까지"는 곡, "fromis"의 from은 아님).
 */
function mentionsSong(title, songs) {
  const t = normalize(title);
  for (const song of songs) {
    const isLatinTail = !/[가-힣]$/.test(song);
    let from = 0;
    for (;;) {
      const i = t.indexOf(song, from);
      if (i < 0) break;
      from = i + 1;
      const after = t[i + song.length] || '';
      // 조사가 붙는 경우(…ME까지)는 허용, 같은 문자 종류로 이어지면 부분 일치
      if (WORD_CHAR.test(after) && !(isLatinTail && /[가-힣]/.test(after))) continue;
      if (i === 0) return true;
      let j = i - 1;
      while (j >= 0 && /\s/.test(t[j])) j--;
      if (j < 0 || !WORD_CHAR.test(t[j])) return true;
    }
  }
  return false;
}

/**
 * 음방 채널 영상의 실제 카테고리 판별
 * @returns {'music'|'variety'}
 */
export function classifyMusicTitle(title, songs) {
  if (NOT_STAGE_RE.test(title)) return 'variety';
  if (mentionsSong(title, songs)) return 'music';
  if (STAGE_RE.test(title)) return 'music';
  return ARTIST_SONG_RE.test(normalize(title)) ? 'music' : 'variety';
}

/**
 * 봇 분류가 'music'일 때만 제목으로 한 번 더 거른다.
 * 다른 카테고리(공식·스프·예능)는 채널이 곧 분류라 그대로 둔다.
 */
export async function refineCategory(db, category, title) {
  if (category !== 'music') return category;
  const songs = await loadSongTitles(db);
  return classifyMusicTitle(title, songs);
}
