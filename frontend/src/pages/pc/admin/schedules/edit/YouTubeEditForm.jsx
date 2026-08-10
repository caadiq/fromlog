/**
 * YouTube 일정 수정 폼 — 에디토리얼 리뉴얼
 * - 기존 일정 데이터 로드
 * - 영상 유형(Video/Shorts) 수정
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/pc/admin/layout/Layout';
import Toast from '@/components/common/Toast';
import { AdminPageHeader, F } from '@/components/pc/admin';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useToast, useDocumentTitle } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import useAuthStore from '@/stores/useAuthStore';
import { WEEKDAYS } from '@/constants';

function YouTubeEditForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAdminAuth();
  const { toast, setToast } = useToast();
  useDocumentTitle('일정 수정');

  const [saving, setSaving] = useState(false);
  const [videoType, setVideoType] = useState('video');
  const [isInitialized, setIsInitialized] = useState(false);

  // 일정 데이터 로드
  const { data: schedule, isLoading: scheduleLoading, isError: scheduleError } = useQuery({
    queryKey: ['schedule', id],
    queryFn: async () => {
      const token = useAuthStore.getState().token;
      const res = await fetch(`/api/schedules/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('일정을 찾을 수 없습니다.');
      return res.json();
    },
    enabled: isAuthenticated && !!id,
    retry: false,
  });

  // 일정 데이터 로드 후 초기값 설정
  useEffect(() => {
    if (schedule && !isInitialized) {
      // YouTube 일정인지 확인
      if (schedule.category?.id !== 2) {
        setToast({ type: 'error', message: 'YouTube 일정이 아닙니다.' });
        navigate('/admin/schedule');
        return;
      }
      setVideoType(schedule.videoType || 'video');
      setIsInitialized(true);
    }
  }, [schedule, isInitialized, navigate, setToast]);

  const loading = scheduleLoading;

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = useAuthStore.getState().token;

      const response = await fetch(`/api/admin/youtube/schedule/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '수정에 실패했습니다.');
      }

      // 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['schedule', id] });

      sessionStorage.setItem(
        'scheduleToast',
        JSON.stringify({
          type: 'success',
          message: 'YouTube 일정이 수정되었습니다.',
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

  if (loading) {
    return (
      <AdminLayout user={user}>
        <div className="flex min-h-[400px] items-center justify-center">
          <span className="text-[14.5px] text-mute">로딩 중...</span>
        </div>
      </AdminLayout>
    );
  }

  if (scheduleError || !schedule) {
    return (
      <AdminLayout user={user}>
        <div className="flex min-h-[calc(100dvh-200px)] flex-1 items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="px-6 text-center text-ink"
          >
            <div className="text-[64px] font-black leading-none tracking-[-3px] text-faint-light">404</div>
            <h2 className="mt-5 text-[19px] font-extrabold tracking-[-0.4px]">일정을 찾을 수 없습니다</h2>
            <p className="mt-2.5 text-[14.5px] text-mute">요청하신 일정이 존재하지 않거나 삭제되었을 수 있습니다.</p>
            <div className="mt-8 flex justify-center gap-2">
              <button
                onClick={() => window.history.back()}
                className="border border-hairline bg-white px-6 py-3 text-[13px] font-extrabold tracking-k15 text-esub transition-colors hover:border-ink hover:text-ink"
              >
                ← 이전 페이지
              </button>
              <Link
                to="/admin/schedule"
                className="bg-ink px-6 py-3 text-[13px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody"
              >
                일정 목록
              </Link>
            </div>
          </motion.div>
        </div>
      </AdminLayout>
    );
  }

  const videoUrl =
    videoType === 'shorts'
      ? `https://www.youtube.com/shorts/${schedule.videoId}`
      : `https://www.youtube.com/watch?v=${schedule.videoId}`;

  // 날짜 포맷팅 함수
  const formatDatetime = (dateStr, timeStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const time = timeStr ? timeStr.slice(0, 5) : '';
    return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. (${WEEKDAYS[date.getDay()]}) ${time}`;
  };

  // 유형 토글 칩
  const typeChip = (value, label) => (
    <button
      type="button"
      onClick={() => setVideoType(value)}
      className={`px-3.5 py-[7px] text-[12px] font-extrabold tracking-k1 transition-colors ${
        videoType === value
          ? value === 'shorts'
            ? 'bg-[#D4548A] text-white'
            : 'bg-ink text-white'
          : 'border border-hairline bg-white text-esub hover:border-ink'
      }`}
    >
      {label}
    </button>
  );

  const infoBlock = (
    <>
      <h3 className="text-[17.5px] font-extrabold leading-[1.45] tracking-[-0.3px] text-ink">
        {schedule.title}
      </h3>
      <div className="mt-3 text-[13.5px] leading-[1.9] text-mute">
        채널 <b className="font-bold text-ebody">{schedule.channelName}</b>
        <br />
        업로드{' '}
        <b className="font-bold text-ebody" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatDatetime(schedule.date, schedule.time)}
        </b>
      </div>
      <div className="mt-5">
        <label className={F.label}>영상 유형</label>
        <div className="mt-2 flex gap-1.5">
          {typeChip('video', 'VIDEO')}
          {typeChip('shorts', 'SHORTS')}
        </div>
      </div>
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-block border border-ink px-4 py-2.5 text-[12.5px] font-extrabold tracking-k15 text-ink transition-colors hover:bg-ink hover:text-white"
      >
        YouTube에서 보기 →
      </a>
    </>
  );

  return (
    <AdminLayout user={user}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="mx-auto w-full max-w-[880px] px-10 pb-[90px] pt-[52px]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <AdminPageHeader crumb="ADMIN / SCHEDULE / EDIT" solid="EDIT " outline="YOUTUBE" />
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
        >
          <div className="mt-10 border-t-2 border-ink pt-[26px]">
            {videoType === 'shorts' ? (
              /* Shorts 레이아웃: 영상(왼쪽) + 정보(오른쪽) */
              <div className="flex gap-8">
                <div className="w-[300px] flex-shrink-0">
                  <div className="relative aspect-[9/16] overflow-hidden bg-ink">
                    <iframe
                      src={`https://www.youtube.com/embed/${schedule.videoId}`}
                      title={schedule.title}
                      className="absolute inset-0 h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
                <div className="min-w-0 flex-1 pt-1">{infoBlock}</div>
              </div>
            ) : (
              /* Video 레이아웃: 세로 배치 */
              <>
                <div className="relative aspect-video w-full overflow-hidden bg-ink">
                  <iframe
                    src={`https://www.youtube.com/embed/${schedule.videoId}`}
                    title={schedule.title}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="mt-6">{infoBlock}</div>
              </>
            )}
          </div>

          {/* 버튼 */}
          <div className={F.footer}>
            <button type="button" onClick={() => navigate('/admin/schedule')} className={F.btn}>
              취소
            </button>
            <button type="submit" disabled={saving} className={F.btnInk}>
              {saving ? '저장 중...' : '수정하기'}
            </button>
          </div>
        </motion.form>
      </div>
    </AdminLayout>
  );
}

export default YouTubeEditForm;
