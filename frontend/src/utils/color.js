/**
 * 카테고리 색상 관련 유틸리티
 */

// Tailwind 색상 맵
export const COLOR_MAP = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  red: 'bg-red-500',
  pink: 'bg-pink-500',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  gray: 'bg-gray-500',
  cyan: 'bg-cyan-500',
  indigo: 'bg-indigo-500',
};

// 색상 옵션 (카테고리 관리에서 사용)
export const COLOR_OPTIONS = [
  { id: 'blue', name: '파란색', bg: 'bg-blue-500', hex: '#3b82f6' },
  { id: 'green', name: '초록색', bg: 'bg-green-500', hex: '#22c55e' },
  { id: 'purple', name: '보라색', bg: 'bg-purple-500', hex: '#a855f7' },
  { id: 'red', name: '빨간색', bg: 'bg-red-500', hex: '#ef4444' },
  { id: 'pink', name: '분홍색', bg: 'bg-pink-500', hex: '#ec4899' },
  { id: 'yellow', name: '노란색', bg: 'bg-yellow-500', hex: '#eab308' },
  { id: 'orange', name: '주황색', bg: 'bg-orange-500', hex: '#f97316' },
  { id: 'gray', name: '회색', bg: 'bg-gray-500', hex: '#6b7280' },
];

/**
 * 색상 스타일 반환 (기본 색상 또는 커스텀 HEX)
 * @param {string} color - 색상 ID ('blue', 'green' 등) 또는 HEX 코드 ('#3b82f6')
 * @returns {{ className?: string, style?: object }} - Tailwind 클래스 또는 인라인 스타일
 */
export function getColorStyle(color) {
  if (!color) {
    return { className: 'bg-gray-500' };
  }
  if (color.startsWith('#')) {
    return { style: { backgroundColor: color } };
  }
  return { className: COLOR_MAP[color] || 'bg-gray-500' };
}
