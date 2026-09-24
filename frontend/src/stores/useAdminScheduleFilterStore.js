import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Keep admin filters across navigation and reloads within the current tab.
const useAdminScheduleFilterStore = create(persist((set) => ({
  selectedCategories: [],
  setSelectedCategories: (value) => set((state) => ({
    selectedCategories: typeof value === 'function' ? value(state.selectedCategories) : value,
  })),
}), {
  name: 'admin-schedule-filters',
  storage: createJSONStorage(() => sessionStorage),
  partialize: ({ selectedCategories }) => ({ selectedCategories }),
}));

export default useAdminScheduleFilterStore;
