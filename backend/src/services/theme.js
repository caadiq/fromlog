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
