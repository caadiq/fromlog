/**
 * 동적 테마 컬러 서비스
 *
 * - 앨범 커버에서 대표색을 추출(sharp)해 가독성 있는 primary hex로 정규화
 * - primary → soft(칩 배경) / deep(칩 텍스트) 팔레트 파생
 * - 설정(app_settings)과 최신 앨범을 조합해 현재 테마 색을 해석
 */
import sharp from 'sharp';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('theme');

/** 브랜드 기본 팔레트 (에디토리얼 그린) — 추출/수동색이 없을 때 폴백 */
export const DEFAULT_PALETTE = {
  primary: '#548360',
  soft: '#EDF5EF',
  deep: '#3E6348',
};

// ── 색 변환 유틸 ──────────────────────────────────────────────

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const c = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function rgbToHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

function hslToHex({ h, s, l }) {
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

// ── 정규화 & 팔레트 파생 ─────────────────────────────────────

/**
 * 임의의 색을 버튼/링크에 쓸 수 있는 가독성 있는 primary로 정규화.
 * 흰 텍스트가 얹히므로 명도를 어둡게, 채도는 적당히 유지.
 */
export function normalizePrimary(hex) {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  // 채도: 너무 탁하면 올리고, 네온은 낮춤
  const ns = clamp(s, 0.32, 0.72);
  // 명도: 흰 텍스트 대비 확보 (0.30~0.44 밴드)
  const nl = clamp(l, 0.3, 0.44);
  return hslToHex({ h, s: ns, l: nl });
}

/**
 * primary → { primary, soft, deep } 팔레트
 * soft: 아주 옅은 배경(칩), deep: 어두운 텍스트/강조
 */
export function derivePalette(primaryHex) {
  const primary = normalizePrimary(primaryHex);
  const { h, s } = rgbToHsl(hexToRgb(primary));
  const soft = hslToHex({ h, s: clamp(s * 0.55, 0.16, 0.4), l: 0.93 });
  const deep = hslToHex({ h, s: clamp(s * 0.9, 0.3, 0.62), l: 0.28 });
  return { primary, soft, deep };
}

/**
 * 커버 이미지 버퍼에서 대표색을 추출해 정규화된 primary hex 반환.
 * 추출 실패 시 null.
 */
export async function extractThemeColor(buffer) {
  try {
    const { dominant } = await sharp(buffer).stats();
    if (!dominant) return null;
    const raw = rgbToHex(dominant);
    return normalizePrimary(raw);
  } catch (err) {
    logger.error(`테마 색 추출 실패: ${err.message}`);
    return null;
  }
}

// ── 응원법용 2색 추출 ────────────────────────────────────────

/** 색상환을 나눌 구간 수 (15°) */
const HUE_BUCKETS = 24;
/**
 * 두 색이 "다른 색"으로 보이려면 이만큼은 떨어져야 한다 (도).
 * 45°로 잡으면 17곡 중 10곡만 2색이 나오고 나머지는 명암 차이로 떨어져 구분이 약했다.
 * 30°까지 낮추면 14곡에서 2색이 나온다 — 애매한 곡은 관리자에서 직접 지정한다.
 */
const MIN_HUE_GAP = 30;
/** 두 번째 색이 이 비율보다 적게 잡히면 대표색으로 치지 않는다 */
const MIN_SECOND_RATIO = 0.03;

/** 흰 배경 위 본문 글자로 읽히도록 채도·명도를 고정 */
function asTextColor(rgb) {
  const { h, s } = rgbToHsl(rgb);
  return hslToHex({ h, s: clamp(s, 0.45, 0.85), l: 0.36 });
}

/**
 * 커버에서 서로 구별되는 두 색을 뽑는다 (응원법 '따로 외치기' / '같이 부르기'용).
 *
 * 커버를 64x64로 줄여 색상(hue)별로 픽셀을 모으고, 가장 많은 색과 그 색에서
 * [MIN_HUE_GAP]도 이상 떨어진 색을 고른다. 무채색·너무 밝거나 어두운 픽셀은 센다고
 * 대표성이 없어 제외한다.
 *
 * 단색 커버(9 Way Ticket 등)는 두 번째 색이 거의 안 잡히므로 그때는 second=null로 두고,
 * 호출부가 첫 색의 진한 변주로 폴백한다.
 *
 * @returns {Promise<{first: string, second: string|null}|null>}
 */
export async function extractFanchantColors(buffer) {
  try {
    const size = 64;
    const { data } = await sharp(buffer)
      .resize(size, size, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const buckets = new Map();
    let counted = 0;
    for (let i = 0; i < data.length; i += 3) {
      const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
      const { h, s, l } = rgbToHsl(rgb);
      if (s < 0.18 || l < 0.12 || l > 0.9) continue; // 무채색·흰검 근처는 제외
      const key = Math.floor(h / (360 / HUE_BUCKETS));
      const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      e.n += 1; e.r += rgb.r; e.g += rgb.g; e.b += rgb.b;
      buckets.set(key, e);
      counted += 1;
    }
    if (counted === 0) return null;

    const ranked = [...buckets.entries()]
      .map(([key, e]) => ({ key, n: e.n, rgb: { r: e.r / e.n, g: e.g / e.n, b: e.b / e.n } }))
      .sort((a, b) => b.n - a.n);

    const step = 360 / HUE_BUCKETS;
    const hueGap = (a, b) => {
      const d = Math.abs(a - b) * step;
      return Math.min(d, 360 - d);
    };
    const first = ranked[0];
    const second = ranked
      .slice(1)
      .find((x) => hueGap(x.key, first.key) >= MIN_HUE_GAP && x.n / counted >= MIN_SECOND_RATIO);

    return {
      first: asTextColor(first.rgb),
      second: second ? asTextColor(second.rgb) : null,
    };
  } catch (err) {
    logger.error(`응원법 색 추출 실패: ${err.message}`);
    return null;
  }
}

/** 색 하나뿐일 때 쓸 짝 — 같은 색상의 더 진한 변주 */
export function darkerVariant(hex) {
  const { h, s } = rgbToHsl(hexToRgb(hex));
  return hslToHex({ h, s: clamp(s * 0.95, 0.3, 0.8), l: 0.2 });
}

// ── 현재 테마 해석 ───────────────────────────────────────────

async function getSetting(db, key, fallback = null) {
  const [rows] = await db.query('SELECT `value` FROM app_settings WHERE `key` = ?', [key]);
  return rows.length ? rows[0].value : fallback;
}

/**
 * 현재 적용할 테마 팔레트 해석.
 * - manual 모드 + 수동색 → 수동색
 * - 그 외 → 커버가 있는 가장 최근 앨범의 theme_color
 * - 둘 다 없으면 브랜드 기본색
 * @returns {{mode, source, primary, soft, deep, albumId?}}
 */
export async function resolveTheme(db) {
  const mode = (await getSetting(db, 'theme_mode', 'auto')) || 'auto';
  const manualColor = await getSetting(db, 'theme_manual_color', null);

  if (mode === 'manual' && manualColor) {
    return { mode, source: 'manual', ...derivePalette(manualColor) };
  }

  const [rows] = await db.query(
    `SELECT id, theme_color FROM albums
      WHERE theme_color IS NOT NULL AND cover_medium_url IS NOT NULL
      ORDER BY release_date DESC LIMIT 1`
  );
  if (rows.length) {
    return {
      mode,
      source: 'auto',
      albumId: rows[0].id,
      ...derivePalette(rows[0].theme_color),
    };
  }

  return { mode, source: 'default', ...DEFAULT_PALETTE };
}
