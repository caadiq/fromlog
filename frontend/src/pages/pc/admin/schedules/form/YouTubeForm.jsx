/**
 * YouTube 일정 추가 폼 — 에디토리얼 리뉴얼 (design-drafts/ADM_schedule_new 시안)
 * - URL 입력 시 자동으로 영상 정보 조회
 * - 조회된 정보로 일정 저장
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import Toast from '@/components/common/Toast';
import { F } from '@/components/pc/admin';
import { useToast } from '@/hooks/common';
import useAuthStore from '@/stores/useAuthStore';

function YouTubeForm() {
  const navigate = useNavigate();
  const { toast, setToast } = useToast();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [error, setError] = useState(null);

  // 영상 ID만 입력해도 되도록 풀 URL로 정규화
  const normalizeUrl = (input) => {
    const t = input.trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(t)) return `https://www.youtube.com/watch?v=${t}`;
    return t;
  };

  // YouTube URL에서 영상 정보 조회
  const fetchVideoInfo = async () => {
    if (!url.trim()) {
      setError('YouTube URL 또는 영상 ID를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setVideoInfo(null);

    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(`/api/admin/youtube/video-info?url=${encodeURIComponent(normalizeUrl(url))}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '영상 정보를 가져올 수 없습니다.');
      }

      const data = await response.json();
      setVideoInfo(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // URL 입력 후 엔터 키
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchVideoInfo();
    }
  };

  // 초기화
  const handleReset = () => {
    setUrl('');
    setVideoInfo(null);
    setError(null);
  };

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!videoInfo) {
      setError('먼저 YouTube URL을 입력하고 조회해주세요.');
      return;
    }

    setSaving(true);

    try {
      const token = useAuthStore.getState().token;

      const response = await fetch('/api/admin/youtube/schedule', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: videoInfo.videoId,
          title: videoInfo.title,
          channelId: videoInfo.channelId,
          channelName: videoInfo.channelName,
          date: videoInfo.date,
          time: videoInfo.time,
          videoType: videoInfo.videoType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '일정 저장에 실패했습니다.');
      }

      // 성공 메시지를 sessionStorage에 저장하고 목록 페이지로 이동
      sessionStorage.setItem(
        'scheduleToast',
        JSON.stringify({
          type: 'success',
          message: 'YouTube 일정이 추가되었습니다.',
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
          {/* URL 입력 필드 */}
          <label className={F.label}>YOUTUBE URL / 영상 ID *</label>
          <div className="mt-2 flex items-end gap-2.5">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://youtu.be/IoaLmRfEWb8 또는 IoaLmRfEWb8"
              className={F.underlineSm}
              disabled={loading || videoInfo}
            />
            {!videoInfo ? (
              <button
                type="button"
                onClick={fetchVideoInfo}
                disabled={loading || !url.trim()}
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

          {/* 영상 정보 미리보기 */}
          {videoInfo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-[30px] flex gap-6 border border-hairline bg-white p-5"
            >
              {/* 썸네일 */}
              <div className="relative aspect-video w-[300px] flex-shrink-0 overflow-hidden bg-ink">
                <img
                  src={`https://img.youtube.com/vi/${videoInfo.videoId}/mqdefault.jpg`}
                  alt={videoInfo.title}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* 정보 */}
              <div className="min-w-0 flex-1 pt-1">
                <span
                  className={`inline-block px-2.5 py-1 text-[12px] font-extrabold tracking-k15 ${
                    videoInfo.videoType === 'shorts'
                      ? 'bg-[#FDEFF4] text-[#D4548A]'
                      : 'bg-green-soft text-green-deep'
                  }`}
                >
                  {videoInfo.videoType === 'shorts' ? 'SHORTS' : 'VIDEO'}
                </span>
                <h3 className="mt-2.5 line-clamp-2 text-[17.5px] font-extrabold leading-[1.45] tracking-[-0.3px] text-ink">
                  {videoInfo.title}
                </h3>
                <div className="mt-3 text-[13.5px] leading-[1.9] text-mute">
                  채널 <b className="font-bold text-ebody">{videoInfo.channelName}</b>
                  <br />
                  업로드{' '}
                  <b className="font-bold text-ebody" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {videoInfo.date} {videoInfo.time}
                  </b>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* 버튼 */}
        <div className={F.footer}>
          <button type="button" onClick={() => navigate('/admin/schedule')} className={F.btn}>
            취소
          </button>
          <button type="submit" disabled={!videoInfo || saving} className={F.btnInk}>
            {saving ? '저장 중...' : '일정 추가'}
          </button>
        </div>
      </form>
    </>
  );
}

export default YouTubeForm;
