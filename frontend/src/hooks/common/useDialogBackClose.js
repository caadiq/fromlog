import { useEffect, useRef } from 'react';

/**
 * 다이얼로그가 열려 있을 때 브라우저 뒤로가기를 누르면
 * 페이지 이동 대신 다이얼로그만 닫히게 하는 훅.
 *
 * 동작:
 * - 열릴 때 같은 URL로 history state를 하나 쌓고 전역 스택에 등록
 * - 뒤로가기(popstate) → 스택 최상단 다이얼로그 하나만 닫힘 (LIFO, 페이지 유지)
 * - 버튼/배경 클릭 등 UI로 닫히면 → 쌓아둔 state를 history.back()으로 소비
 *   (이때 발생하는 popstate는 무시해 다른 다이얼로그가 닫히지 않게 함)
 */

/** 열려 있는 다이얼로그 스택 (마지막 = 최상단) */
const stack = [];
/** 프로그램적 back()으로 인한 popstate 무시 카운터 */
let suppress = 0;
let listenerAttached = false;

function handlePopstate() {
  if (suppress > 0) {
    suppress -= 1;
    return;
  }
  const top = stack.pop();
  if (top) top.close();
}

/**
 * @param {boolean} isOpen - 다이얼로그 열림 상태
 * @param {Function} onClose - 닫기 콜백
 */
export function useDialogBackClose(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;

    if (!listenerAttached) {
      window.addEventListener('popstate', handlePopstate);
      listenerAttached = true;
    }

    const entry = { close: () => onCloseRef.current?.() };
    stack.push(entry);
    window.history.pushState({ __dialog: true }, '');
    const openedPath = window.location.pathname; // 열릴 때의 경로 기억

    return () => {
      const idx = stack.indexOf(entry);
      if (idx !== -1) {
        // 아직 스택에 있음 = 뒤로가기(popstate)로 닫힌 게 아님
        stack.splice(idx, 1);
        // 같은 경로에서 UI로 닫힌 경우에만 쌓아둔 state를 back()으로 소비한다.
        // 다른 경로로 navigate해 언마운트된 경우(예: 검색 결과 클릭 → 상세 이동)
        // 여기서 back()을 하면 그 이동 자체가 취소되므로 건너뛴다.
        if (window.location.pathname === openedPath) {
          suppress += 1;
          window.history.back();
        }
      }
      // idx === -1 이면 뒤로가기로 이미 닫혀 state도 소비된 상태
    };
  }, [isOpen]);
}

export default useDialogBackClose;
