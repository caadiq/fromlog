/**
 * X(Twitter) 일정 추가 폼 — 에디토리얼 리뉴얼 (design-drafts/ADM_schedule_new 시안)
 * - 게시글 ID 입력 시 자동으로 정보 조회
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

import Toast from '@/components/common/Toast';
import { F } from '@/components/pc/admin';
import { useToast } from '@/hooks/common';
import useAuthStore from '@/stores/useAuthStore';

function XForm() {
  const navigate = useNavigate();
  const { toast, setToast } = useToast();

  const [postId, setPostId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [postInfo, setPostInfo] = useState(null);
  const [error, setError] = useState(null);

  // 게시글 ID 추출 (URL에서도 추출 가능)
  const extractPostId = (input) => {
    // 숫자만 있으면 그대로 반환
    if (/^\d+$/.test(input.trim())) {
      return input.trim();
    }
    // URL에서 추출
    const match = input.match(/status\/(\d+)/);
    return match ? match[1] : null;
  };

  // X 게시글 정보 조회
  const fetchPostInfo = async () => {
    const id = extractPostId(postId);
    if (!id) {
      setError('게시글 ID 또는 URL을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setPostInfo(null);

    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`/api/admin/x/post-info?postId=${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '게시글 정보를 가져올 수 없습니다.');
      }

      const data = await response.json();
      setPostInfo(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 입력 후 엔터 키
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchPostInfo();
    }
  };

  // 초기화
  const handleReset = () => {
    setPostId('');
    setPostInfo(null);
    setError(null);
  };

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!postInfo) {
      setError('먼저 게시글 ID를 입력하고 조회해주세요.');
      return;
    }

    setSaving(true);

    try {
      const token = useAuthStore.getState().token;

      const response = await fetch('/api/admin/x/schedule', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId: postInfo.postId,
          title: postInfo.title,
          content: postInfo.text,
          imageUrls: postInfo.imageUrls,
          date: postInfo.date,
          time: postInfo.time,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '일정 저장에 실패했습니다.');
      }

      sessionStorage.setItem(
        'scheduleToast',
        JSON.stringify({
          type: 'success',
          message: 'X 일정이 추가되었습니다.',
        })
      );
      navigate('/admin/schedule');
    } catch (err) {
      setToast({
        type: 'error',
        message: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <form onSubmit={handleSubmit}>
        <div className="border-t-2 border-ink pt-[26px]">
          {/* ID 입력 필드 */}
          <label className={F.label}>게시글 ID / URL *</label>
          <div className="mt-2 flex items-end gap-2.5">
            <input
              type="text"
              value={postId}
              onChange={(e) => setPostId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="1234567890 또는 https://x.com/realfromis_9/status/1234567890"
              className={F.underlineSm}
              disabled={loading || postInfo}
            />
            {!postInfo ? (
              <button
                type="button"
                onClick={fetchPostInfo}
                disabled={loading || !postId.trim()}
                className="shrink-0 whitespace-nowrap bg-ink px-[26px] py-3 text-[13px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? '조회 중...' : '조회'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReset}
                className="shrink-0 whitespace-nowrap border border-hairline bg-white px-5 py-3 text-[13px] font-extrabold tracking-k15 text-esub transition-colors hover:border-ink hover:text-ink"
              >
                다시 입력
              </button>
            )}
          </div>

          {/* 에러 메시지 */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={`${F.error} mt-5`}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </motion.div>
          )}

          {/* 게시글 정보 미리보기 */}
          {postInfo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-[30px] border border-hairline bg-white p-6"
            >
              {/* 프로필 */}
              {postInfo.profile?.displayName && (
                <div className="flex items-center gap-3 border-b border-hairline pb-4">
                  {postInfo.profile.avatarUrl && (
                    <img src={postInfo.profile.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                  )}
                  <div>
                    <p className="text-[15px] font-extrabold text-ink">{postInfo.profile.displayName}</p>
                    <p className="text-[13px] text-mute">@{postInfo.username}</p>
                  </div>
                </div>
              )}

              {/* 제목 (첫 문단) */}
              <div className="mt-4">
                <p className={F.label}>제목 (자동 추출)</p>
                <p className="mt-1.5 text-[16.5px] font-extrabold tracking-[-0.2px] text-ink">{postInfo.title}</p>
              </div>

              {/* 전체 내용 */}
              <div className="mt-4">
                <p className={F.label}>전체 내용</p>
                <p className="mt-1.5 whitespace-pre-wrap text-[14.5px] leading-[1.75] text-ebody">{postInfo.text}</p>
              </div>

              {/* 이미지 */}
              {postInfo.imageUrls?.length > 0 && (
                <div className="mt-4">
                  <p className={F.label}>이미지 {postInfo.imageUrls.length}개</p>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {postInfo.imageUrls.map((url, index) => (
                      <div key={index} className="aspect-square overflow-hidden border border-hairline bg-canvas">
                        <img src={url} alt={`이미지 ${index + 1}`} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 날짜/시간 */}
              <div className="mt-4 border-t border-hairline pt-3.5 text-[13.5px] text-mute">
                게시{' '}
                <b className="font-bold text-ebody" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {postInfo.date} {postInfo.time}
                </b>
              </div>
            </motion.div>
          )}
        </div>

        {/* 버튼 */}
        <div className={F.footer}>
          <button type="button" onClick={() => navigate('/admin/schedule')} className={F.btn}>
            취소
          </button>
          <button type="submit" disabled={!postInfo || saving} className={F.btnInk}>
            {saving ? '저장 중...' : '일정 추가'}
          </button>
        </div>
      </form>
    </>
  );
}

export default XForm;
