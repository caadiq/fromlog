import { useAuthStore } from '@/stores';
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { bootstrapTheme } from "./theme";

// 동적 테마 컬러 주입 (캐시 즉시 반영 + /api/theme 갱신)
bootstrapTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5분
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// A previous administrator's cached data must not survive a session change.
useAuthStore.subscribe((state, previous) => {
  if (state.token !== previous.token) {
    queryClient.cancelQueries();
    queryClient.clear();
  }
});
window.addEventListener('storage', event => {
  if (event.key === 'auth-storage' || event.key === null) {
    if (event.newValue === null) useAuthStore.getState().logout();
    else useAuthStore.persist.rehydrate();
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
