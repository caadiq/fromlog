/**
 * DB의 JSON 컬럼 값을 파싱한다.
 * 드라이버 설정에 따라 이미 객체로 올 수도, 문자열로 올 수도 있어 양쪽을 처리한다.
 * null·빈 값·파싱 실패는 fallback을 반환.
 *
 * @param {*} value DB에서 온 값 (문자열 JSON | 객체 | null)
 * @param {*} fallback 기본값 (기본 null)
 */
export function parseJsonColumn(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
