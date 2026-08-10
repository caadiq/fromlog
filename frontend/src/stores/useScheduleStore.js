import { create } from 'zustand';

/**
 * 스케줄 페이지 상태 스토어
 * 메모리 기반 - SPA 내 페이지 이동 시 유지, 새로고침 시 초기화
 */
const useScheduleStore = create((set, get) => ({
  // ===== 검색 관련 =====
  searchInput: '',
  searchTerm: '',
  isSearchMode: false,

  // ===== 필터 관련 =====
  selectedCategories: [],

  // ===== 날짜 관련 =====
  selectedDate: undefined, // undefined: 오늘, null: 전체, Date: 특정 날짜
  currentDate: new Date(),

  // ===== 뷰 관련 =====
  viewMode: 'list', // 'list' | 'calendar'
  scrollPosition: 0,

  // ===== 검색 액션 =====
  setSearchInput: (value) => set({ searchInput: value }),
  setSearchTerm: (value) => set({ searchTerm: value }),
  setIsSearchMode: (value) => set({ isSearchMode: value }),

  startSearch: (term) => {
    set({
      searchTerm: term,
      isSearchMode: true,
      selectedDate: null, // 검색 시 날짜 필터 해제
    });
  },

  clearSearch: () => {
    set({
      searchInput: '',
      searchTerm: '',
      isSearchMode: false,
    });
  },

  // ===== 필터 액션 =====
  setSelectedCategories: (value) => set({ selectedCategories: value }),

  toggleCategory: (categoryId) => {
    const { selectedCategories } = get();
    const isSelected = selectedCategories.includes(categoryId);
    set({
      selectedCategories: isSelected
        ? selectedCategories.filter((id) => id !== categoryId)
        : [...selectedCategories, categoryId],
    });
  },


  clearFilters: () => {
    set({
      selectedCategories: [],
    });
  },

  // ===== 날짜 액션 =====
  setSelectedDate: (value) => set({ selectedDate: value }),
  setCurrentDate: (value) => set({ currentDate: value }),

  goToToday: () => {
    set({
      selectedDate: undefined,
      currentDate: new Date(),
    });
  },

  // ===== 뷰 액션 =====
  setViewMode: (mode) => set({ viewMode: mode }),
  setScrollPosition: (value) => set({ scrollPosition: value }),

  // ===== 전체 초기화 =====
  reset: () =>
    set({
      searchInput: '',
      searchTerm: '',
      isSearchMode: false,
      selectedCategories: [],
      selectedDate: undefined,
      currentDate: new Date(),
      viewMode: 'list',
      scrollPosition: 0,
    }),
}));

export default useScheduleStore;
