/**
 * 응원법 서비스
 *
 * 곡 하나당 응원법 한 벌(track_fanchant). 저장 형태와 색 결정 규칙을 여기 모은다.
 *
 * lines 구조 (sql/track_fanchant.sql 참고)
 *   [ { t, parts: [ { text, type?, t? } ] }, { gap: true }, … ]
 *   - 줄의 t  : 그 줄이 시작되는 시각(초). 세로 바·지나간 줄 흐리기에 쓴다
 *   - part의 t: 그 조각이 시작되는 시각. 응원법 조각은 그 순간에만 배경이 들어온다
 *   - type    : 'call'(팬만 따로 외치는 부분) | 'sing'(멤버와 같이 부르는 부분). 없으면 일반 가사
 *   - hold    : 뒤따르는 가사가 흐르는 동안에도 문단 끝까지 강조를 유지 (함성처럼 길게 외치는 것)
 */
import { extractFanchantColors, darkerVariant } from './theme.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('fanchant');

export const PART_TYPES = ['call', 'sing'];

/** 색을 못 뽑았을 때 쓰는 기본값 (브랜드 그린 계열) */
const FALLBACK_COLORS = { call: '#548360', sing: '#3E6348' };

/**
 * 저장 전 정규화 — 신뢰할 수 없는 입력에서 필요한 필드만 남긴다.
 * 시간은 초 단위 소수 2자리로 자르고, 안 찍힌 지점은 null로 통일한다.
 */
export function normalizeLines(input) {
  if (!Array.isArray(input)) return [];
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null);

  return input.map((line) => {
    if (line?.gap) return { gap: true };
    const parts = Array.isArray(line?.parts) ? line.parts : [];
    return {
      t: num(line?.t),
      parts: parts
        .map((p) => {
          const text = String(p?.text ?? '');
          const type = PART_TYPES.includes(p?.type) ? p.type : null;
          // 가사 조각도 시각을 갖는다 — 한 줄에 응원법이 끼면 조각마다 시작이 달라
          // 각각 찍어야 하기 때문(예: from / summer days / to the / last dance)
          const t = num(p?.t);
          // hold: 뒤따르는 가사가 흐르는 동안에도 문단 끝까지 강조를 유지한다(함성 등)
          return type
            ? { text, type, t, ...(p?.hold ? { hold: true } : {}) }
            : { text, ...(t != null ? { t } : {}) };
        })
        .filter((p) => p.text !== ''),
    };
  });
}

/** 응원법 구간(시간을 찍어야 하는 지점)만 순서대로 뽑는다 */
export function collectCues(lines) {
  const cues = [];
  lines.forEach((line, li) => {
    if (line.gap) return;
    cues.push({ kind: 'line', lineIndex: li, partIndex: null, text: line.parts.map((p) => p.text).join(''), t: line.t ?? null });
    line.parts.forEach((p, pi) => {
      if (p.type) cues.push({ kind: p.type, lineIndex: li, partIndex: pi, text: p.text, t: p.t ?? null });
    });
  });
  return cues;
}

/**
 * 곡에 쓸 두 색을 정한다.
 * 수동 지정이 있으면 그대로, 없으면 앨범 커버에서 뽑는다.
 * 커버에서 두 번째 색이 안 나오면(단색 커버) 첫 색의 진한 변주로 채운다.
 *
 * @param {{color_call?:string|null, color_sing?:string|null}} row track_fanchant 행
 * @param {string|null} coverUrl 앨범 커버 URL
 */
export async function resolveColors(row, coverUrl) {
  if (row?.color_call && row?.color_sing) {
    return { call: row.color_call, sing: row.color_sing, source: 'manual' };
  }

  let auto = null;
  if (coverUrl) {
    try {
      const res = await fetch(coverUrl);
      if (res.ok) auto = await extractFanchantColors(Buffer.from(await res.arrayBuffer()));
    } catch (err) {
      logger.warn(`커버 색 추출 실패 (${coverUrl}): ${err.message}`);
    }
  }

  if (!auto) return { ...FALLBACK_COLORS, source: 'default' };
  return {
    call: row?.color_call || auto.first,
    sing: row?.color_sing || auto.second || darkerVariant(auto.first),
    source: auto.second ? 'cover' : 'cover-variant',
  };
}
