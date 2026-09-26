import { useState, useEffect, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { getSuggestions } from '@/api';
import { SEARCH_LIMIT } from '@/constants';

/**
 * 검색어 자동완성 (디바운스 + getSuggestions).
 * query가 비면 자동으로 초기화되므로 검색 종료 시 originalSearchQuery만 비우면 된다.
 *
 * @param {string} query 원본 입력값
 * @returns {{ suggestions: string[], isLoadingSuggestions: boolean }}
 */
export function useSuggestions(query, { debounceMs = 200 } = {}) {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoadingSuggestions(false);
    if (!query || query.trim().length === 0) {
      setSuggestions([]);
      return;
    }
    const id = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const results = await getSuggestions(query);
        if (active) setSuggestions(results);
      } catch {
        if (active) setSuggestions([]);
      } finally {
        if (active) setIsLoadingSuggestions(false);
      }
    }, debounceMs);
    return () => { active = false; clearTimeout(id); };
  }, [query, debounceMs]);

  return { suggestions, isLoadingSuggestions };
}

/**
 * 일정 검색 무한 스크롤 — Meilisearch 페이징 + 결과 평탄화 + 카테고리 집계 +
 * 하단 감지 자동 로드. 상태 소스(스토어/로컬)와 무관하게 searchTerm·enabled 값만 받는다.
 *
 * @param {object} p
 * @param {(q:string, opts:{offset:number,limit:number})=>Promise} p.searchApi 검색 API (공개/관리자)
 * @param {string} p.queryKey react-query 키 프리픽스 (충돌 방지용, 화면별로 다름)
 * @param {string} p.searchTerm 확정된 검색어
 * @param {boolean} p.enabled 검색 모드 여부
 */
export function useInfiniteScheduleSearch({ searchApi, queryKey, searchTerm, enabled, selectedCategories = [] }) {
  const { ref: loadMoreRef, inView } = useInView({ threshold: 0, rootMargin: '100px' });

  const {
    data: searchData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    isLoading: searchLoading,
    isError: searchError,
    refetch: retrySearch,
  } = useInfiniteQuery({
    queryKey: [queryKey, searchTerm],
    initialPageParam: 0,
    queryFn: ({ pageParam = 0 }) => searchApi(searchTerm, { offset: pageParam, limit: SEARCH_LIMIT }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.offset + lastPage.schedules.length : undefined,
    enabled: !!searchTerm && enabled,
  });

  const searchResults = useMemo(
    () => (searchData?.pages ? searchData.pages.flatMap((page) => page.schedules) : []),
    [searchData]
  );

  const searchCategories = useMemo(() => {
    const map = new Map();
    searchResults.forEach((r) => {
      if (r.category_id && !map.has(r.category_id)) {
        map.set(r.category_id, { id: r.category_id, name: r.category_name, color: r.category_color });
      }
    });
    return [...map.values()];
  }, [searchResults]);

  // Continue while the sentinel remains visible, including short/filtered pages.
  const needsFilteredPage = selectedCategories.length > 0
    && !searchResults.some(row => selectedCategories.includes(row.category_id));
  useEffect(() => {
    if ((inView || needsFilteredPage) && hasNextPage && !isFetching && !searchError && enabled && searchTerm) {
      fetchNextPage();
    }
  }, [inView, needsFilteredPage, hasNextPage, isFetching, searchError, fetchNextPage, enabled, searchTerm]);

  return {
    searchResults,
    searchCategories,
    loadMoreRef,
    hasNextPage,
    isFetchingNextPage,
    searchLoading,
    searchError,
    retrySearch,
  };
}
