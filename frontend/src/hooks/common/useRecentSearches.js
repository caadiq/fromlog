import { useState, useCallback } from 'react';

/**
 * 최근 검색어 localStorage 관리 (일정 검색 PC·모바일 공용)
 *
 * add/remove는 함수형 setState로 최신 값을 읽는다 — 빠른 연속 호출에서
 * 클로저가 이전 목록을 잡는 stale 문제를 피한다.
 *
 * @param {string} key localStorage 키
 * @param {number} max 최대 보관 개수 (기본 10)
 */
export function useRecentSearches(key, max = 10) {
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const write = useCallback(
    (list) => {
      try {
        localStorage.setItem(key, JSON.stringify(list));
      } catch {
        /* 무시 */
      }
    },
    [key]
  );

  const addRecentSearch = useCallback(
    (term) => {
      const t = (term || '').trim();
      if (!t) return;
      setRecentSearches((prev) => {
        const next = [t, ...prev.filter((s) => s !== t)].slice(0, max);
        write(next);
        return next;
      });
    },
    [write, max]
  );

  const removeRecentSearch = useCallback(
    (term) => {
      setRecentSearches((prev) => {
        const next = prev.filter((s) => s !== term);
        write(next);
        return next;
      });
    },
    [write]
  );

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    write([]);
  }, [write]);

  return { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches };
}

export default useRecentSearches;
