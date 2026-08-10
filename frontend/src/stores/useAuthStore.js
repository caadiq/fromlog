import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 인증 상태 스토어
 * localStorage에 지속되어 새로고침 후에도 유지
 */
const useAuthStore = create(
  persist(
    (set, get) => ({
      // 상태
      token: null,
      user: null,
      isAuthenticated: false,
      _hasHydrated: false,

      // Hydration 완료 설정
      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },

      // 로그인
      login: (token, user) => {
        set({
          token,
          user,
          isAuthenticated: true,
        });
      },

      // 로그아웃
      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export default useAuthStore;
