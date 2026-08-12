/**
 * 관리자 로그인 페이지 — 에디토리얼 리뉴얼 (design-drafts/ADM_login 시안)
 */
import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/stores';
import { useRedirectIfAuthenticated, useGoogleSignIn } from '@/hooks/pc/admin';
import { useDocumentTitle } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import * as authApi from '@/api/admin/auth';

function AdminLogin() {
  useDocumentTitle('관리자 로그인');
  const navigate = useNavigate();
  const loginStore = useAuthStore((state) => state.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 이미 로그인된 경우 리다이렉트
  const { isLoading: checkingAuth } = useRedirectIfAuthenticated();

  // 로그인 mutation
  const loginMutation = useMutation({
    mutationFn: () => authApi.login(username, password),
    onSuccess: (data) => {
      loginStore(data.token, data.user);
      navigate('/admin/dashboard');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  // 구글 로그인 성공 시에도 비밀번호 로그인과 똑같이 처리한다
  const handleGoogleSuccess = useCallback(
    (data) => {
      loginStore(data.token, data.user);
      navigate('/admin/dashboard');
    },
    [loginStore, navigate]
  );
  const google = useGoogleSignIn({ onSuccess: handleGoogleSuccess });

  // 인증 확인 중 로딩 화면
  if (checkingAuth) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <span className="text-[14.5px] text-mute">로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper p-4 text-ink">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE }}
        className="w-full max-w-[420px] text-center"
      >
        {/* 워드마크 */}
        <h1 className="text-[34px] font-black tracking-[-1.5px]">
          fromis
          <em className="not-italic text-transparent" style={{ WebkitTextStroke: '1.6px #141613' }}>
            _9
          </em>
        </h1>
        <span className="mt-3 inline-block bg-ink px-3 py-[5px] text-[12px] font-extrabold tracking-k3 text-white">
          ADMIN
        </span>

        {/* 로그인 카드 */}
        <div className="mt-9 border border-ink bg-white px-[38px] pb-9 pt-10 text-left">
          {/* 에러 메시지 */}
          {loginMutation.isError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-center gap-2 border border-[#E5B8B3] bg-[#F9E9E7] px-4 py-3 text-[#C0392B]"
            >
              <AlertCircle size={15} />
              <span className="text-[14px] font-semibold">
                {loginMutation.error?.message || '로그인 실패'}
              </span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            <label className="text-[12px] font-extrabold tracking-k25 text-mute">ID</label>
            <div className="mb-[26px] mt-2 flex items-center gap-2.5 border-b-2 border-ink px-0.5 pb-2.5 pt-1">
              <User size={15} className="shrink-0 text-mute" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[16px] font-bold text-ink placeholder-faint outline-none"
                placeholder="아이디를 입력하세요"
                required
              />
            </div>

            <label className="text-[12px] font-extrabold tracking-k25 text-mute">PASSWORD</label>
            <div className="mt-2 flex items-center gap-2.5 border-b-2 border-ink px-0.5 pb-2.5 pt-1">
              <Lock size={15} className="shrink-0 text-mute" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[16px] font-bold text-ink placeholder-faint outline-none"
                placeholder="비밀번호를 입력하세요"
                required
              />
              <button
                type="button"
                aria-label="비밀번호 표시"
                onClick={() => setShowPassword(!showPassword)}
                className="shrink-0 text-faint transition-colors hover:text-ink"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="mt-9 w-full bg-ink py-[15px] text-[13.5px] font-extrabold tracking-k2 text-white transition-colors hover:bg-ebody disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loginMutation.isPending ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* 구글 로그인 — 설정돼 있을 때만 나온다. 비밀번호 로그인은 비상용으로 남겨둔다. */}
          {google.enabled && (
            <div className="mt-7">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-hairline" />
                <span className="text-[12px] font-extrabold tracking-k2 text-faint">또는</span>
                <span className="h-px flex-1 bg-hairline" />
              </div>
              <div className="mt-5 flex justify-center" ref={google.buttonRef} />
              {google.pending && (
                <p className="mt-3 text-[13px] text-mute">구글 계정 확인 중...</p>
              )}
              {google.error && (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-[#C0392B]">
                  <AlertCircle size={14} className="shrink-0" />
                  {google.error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 하단 링크 */}
        <Link to="/" className="mt-6 inline-block text-[13.5px] text-mute transition-colors hover:text-ink">
          &larr; 메인 사이트로 돌아가기
        </Link>
      </motion.div>
    </div>
  );
}

export default AdminLogin;
