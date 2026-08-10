/**
 * 동적 테마 컬러 부트스트랩
 *
 * /api/theme 에서 팔레트(hex)를 받아 CSS 변수(RGB 채널)로 주입한다.
 * localStorage 캐시로 첫 페인트를 즉시 반영하고, fetch 결과로 갱신한다.
 */

const CACHE_KEY = 'fromis-theme-palette';

/** "#RRGGBB" → "r g b" (Tailwind rgb(var(--x) / a) 형식) */
function hexToTriplet(hex) {
  if (typeof hex !== 'string') return null;
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return `${r} ${g} ${b}`;
}

/** 팔레트({primary, soft, deep})를 CSS 변수로 적용 */
export function applyPalette(palette) {
  if (!palette) return;
  const root = document.documentElement;
  const set = (name, hex) => {
    const triplet = hexToTriplet(hex);
    if (triplet) root.style.setProperty(name, triplet);
  };
  set('--c-primary', palette.primary);
  set('--c-primary-soft', palette.soft);
  set('--c-primary-deep', palette.deep);
}

/** 팔레트를 즉시 적용 + 캐시 갱신 (관리자 저장 직후 전체 사이트 반영) */
export function applyAndCachePalette(palette) {
  if (!palette) return;
  const clean = { primary: palette.primary, soft: palette.soft, deep: palette.deep };
  applyPalette(clean);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(clean));
  } catch {
    // 무시
  }
}

/** 캐시 즉시 반영 + /api/theme 로 갱신 */
export async function bootstrapTheme() {
  // 1) 캐시로 즉시 페인트 (FOUC 방지)
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached) applyPalette(cached);
  } catch {
    // 무시
  }

  // 2) 서버 최신값으로 갱신
  try {
    const res = await fetch('/api/theme');
    if (!res.ok) return;
    const p = await res.json();
    const palette = { primary: p.primary, soft: p.soft, deep: p.deep };
    applyPalette(palette);
    localStorage.setItem(CACHE_KEY, JSON.stringify(palette));
  } catch {
    // 네트워크 실패 시 CSS 기본값(:root) 유지
  }
}
