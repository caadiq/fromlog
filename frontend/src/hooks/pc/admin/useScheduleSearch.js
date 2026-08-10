/**
 * 일정 검색 관련 커스텀 훅
 * - 검색어 자동완성
 * - 무한 스크롤 검색 결과
 */
import { useState, useCallback } from 'react';
import useScheduleStore from '@/stores/useScheduleStore';
import * as schedulesApi from '@/api/admin/schedules';
import { useSuggestions, useInfiniteScheduleSearch } from '@/hooks/common';

export function useScheduleSearch() {
  // Zustand 스토어에서 검색 상태 가져오기
  const {
    searchInput,
    setSearchInput,
    searchTerm,
    setSearchTerm,
    isSearchMode,
    setIsSearchMode,
  } = useScheduleStore();

  // 검색 추천 관련 상태
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [originalSearchQuery, setOriginalSearchQuery] = useState('');

  // 자동완성 (디바운스) — 공용 훅
  const { suggestions, isLoadingSuggestions } = useSuggestions(originalSearchQuery);

  // 무한 스크롤 검색 — 공용 훅 (관리자 API 사용)
  const { searchResults, loadMoreRef, hasNextPage, isFetchingNextPage, searchLoading } =
    useInfiniteScheduleSearch({
      searchApi: schedulesApi.searchSchedules,
      queryKey: 'adminScheduleSearch',
      searchTerm,
      enabled: isSearchMode,
    });

  // 검색 실행
  const handleSearch = useCallback((query) => {
    const trimmedQuery = query?.trim() || '';
    if (trimmedQuery) {
      setSearchTerm(trimmedQuery);
      setIsSearchMode(true);
    }
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  }, [setSearchTerm, setIsSearchMode]);

  // 검색 모드 종료
  const exitSearchMode = useCallback(() => {
    setIsSearchMode(false);
    setSearchTerm('');
    setSearchInput('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    setOriginalSearchQuery(''); // 빈 값 → useSuggestions가 자동으로 목록 비움
  }, [setIsSearchMode, setSearchTerm, setSearchInput]);

  // 검색어 입력 핸들러
  const handleSearchInputChange = useCallback((value) => {
    setSearchInput(value);
    setOriginalSearchQuery(value);
    setSelectedSuggestionIndex(-1);
    if (value.trim()) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [setSearchInput]);

  // 추천 검색어 선택
  const handleSuggestionSelect = useCallback((suggestion) => {
    setSearchInput(suggestion);
    handleSearch(suggestion);
  }, [setSearchInput, handleSearch]);

  // 키보드 네비게이션 핸들러
  const handleKeyDown = useCallback((e) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        handleSearch(searchInput);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => {
          const next = prev < suggestions.length - 1 ? prev + 1 : prev;
          if (next >= 0 && suggestions[next]) {
            setSearchInput(suggestions[next]);
          }
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => {
          const next = prev > 0 ? prev - 1 : -1;
          if (next === -1) {
            setSearchInput(originalSearchQuery);
          } else if (suggestions[next]) {
            setSearchInput(suggestions[next]);
          }
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
          handleSuggestionSelect(suggestions[selectedSuggestionIndex]);
        } else {
          handleSearch(searchInput);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  }, [showSuggestions, suggestions, selectedSuggestionIndex, searchInput, originalSearchQuery, handleSearch, handleSuggestionSelect, setSearchInput]);

  return {
    // 상태
    searchInput,
    searchTerm,
    isSearchMode,
    setIsSearchMode,
    showSuggestions,
    setShowSuggestions,
    selectedSuggestionIndex,
    suggestions,
    isLoadingSuggestions,
    searchResults,
    searchLoading,
    hasNextPage,
    isFetchingNextPage,

    // 핸들러
    handleSearch,
    exitSearchMode,
    handleSearchInputChange,
    handleSuggestionSelect,
    handleKeyDown,

    // refs
    loadMoreRef,
  };
}

export default useScheduleSearch;
