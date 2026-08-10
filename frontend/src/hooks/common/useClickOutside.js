import { useEffect } from 'react';

/**
 * 대상 요소 바깥의 mousedown을 감지해 핸들러를 실행하는 훅
 * (드롭다운·팝오버를 바깥 클릭으로 닫을 때 사용)
 *
 * @param {React.RefObject} ref - 감지 기준 요소 ref (ref.current 안쪽 클릭은 무시)
 * @param {(event: MouseEvent) => void} handler - 바깥 클릭 시 실행할 콜백
 * @param {boolean} [enabled=true] - false면 리스너를 붙이지 않음 (닫힘 상태에서 비활성화)
 */
export function useClickOutside(ref, handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const listener = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        handler(event);
      }
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler, enabled]);
}
