/**
 * Toast 상태 관리 커스텀 훅
 * 자동 숨김 타이머 및 상태 관리를 제공
 */
import { useState, useEffect, useCallback } from 'react';

function useToast(duration = 3000) {
  const [toast, setToast] = useState(null);

  // Toast 자동 숨김
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), duration);
      return () => clearTimeout(timer);
    }
  }, [toast, duration]);

  // Toast 표시 함수
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
  }, []);

  // 편의 메서드
  const showSuccess = useCallback((message) => showToast(message, 'success'), [showToast]);
  const showError = useCallback((message) => showToast(message, 'error'), [showToast]);
  const showWarning = useCallback((message) => showToast(message, 'warning'), [showToast]);
  const showInfo = useCallback((message) => showToast(message, 'info'), [showToast]);

  // Toast 숨김 함수
  const hideToast = useCallback(() => setToast(null), []);

  return {
    toast,
    setToast,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hideToast,
  };
}

export default useToast;
