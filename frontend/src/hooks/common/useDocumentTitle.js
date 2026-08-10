import { useEffect } from 'react';

const SUFFIX = 'fromlog';
const DEFAULT_TITLE = 'fromlog';

/**
 * 페이지/항목별 브라우저 탭 제목 설정
 * @param {string} title - 페이지 제목. 없으면(빈 값) 기본 제목으로.
 *   결과: `${title} - fromlog` / 없으면 'fromlog'
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} - ${SUFFIX}` : DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title]);
}
