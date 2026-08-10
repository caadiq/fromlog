import { clsx } from 'clsx';

/**
 * className 유틸리티
 * clsx를 래핑하여 조건부 클래스 조합을 쉽게 처리
 *
 * @example
 * cn('base-class', isActive && 'active', { 'error': hasError })
 * // => 'base-class active error' (조건에 따라)
 *
 * @param {...(string|object|array|boolean|null|undefined)} inputs - 클래스 입력
 * @returns {string} 조합된 클래스 문자열
 */
export function cn(...inputs) {
  return clsx(inputs);
}
