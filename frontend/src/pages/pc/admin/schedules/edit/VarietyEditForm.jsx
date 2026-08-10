/**
 * 예능 일정 수정 폼 — 에디토리얼 리뉴얼
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Image } from 'lucide-react';
import DatePicker from '@/components/pc/admin/common/DatePicker';
import TimePicker from '@/components/pc/admin/common/TimePicker';

import AdminLayout from '@/components/pc/admin/layout/Layout';
import Toast from '@/components/common/Toast';
import { AdminPageHeader, F } from '@/components/pc/admin';
import { useToast, useDocumentTitle } from '@/hooks/common';
import { useAdminAuth } from '@/hooks/pc/admin';
import { EASE } from '@/components/editorial';
import { getVarietySchedule, updateVarietySchedule, getBroadcasters } from '@/api/admin/variety';

function VarietyEditForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast, setToast } = useToast();
  const { isAuthenticated } = useAdminAuth();
  useDocumentTitle('일정 수정');

  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['variety-schedule', id],
    queryFn: () => getVarietySchedule(id),
    enabled: isAuthenticated && !!id,
  });

  const { data: broadcasterPresets = [] } = useQuery({
    queryKey: ['broadcasters'],
    queryFn: getBroadcasters,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  const [title, setTitle] = useState('');
  const [broadcaster, setBroadcaster] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [replayUrl, setReplayUrl] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (scheduleData && !initialized) {
      setTitle(scheduleData.title || '');
      setBroadcaster(scheduleData.broadcaster || '');
      setDate(scheduleData.date || '');
      setTime(scheduleData.time || '');
      setReplayUrl(scheduleData.replayUrl || '');
      if (scheduleData.thumbnailUrl) setThumbnailPreview(scheduleData.thumbnailUrl);
      setInitialized(true);
    }
  }, [scheduleData, initialized]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !broadcaster.trim() || !date) {
      setToast({ type: 'error', message: '필수 항목을 입력해주세요.' });
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('broadcaster', broadcaster.trim());
      formData.append('date', date);
      if (time) formData.append('time', time);
      if (replayUrl.trim()) formData.append('replayUrl', replayUrl.trim());
      if (thumbnailFile) formData.append('thumbnail', thumbnailFile);
      if (removeThumbnail) formData.append('removeThumbnail', 'true');

      await updateVarietySchedule(id, formData);
      // 캐시 제거 — 남겨두면 다음에 수정 화면을 열 때 저장 전 값이 채워진다
      queryClient.removeQueries({ queryKey: ['variety-schedule', id] });
      sessionStorage.setItem(
        'scheduleToast',
        JSON.stringify({ type: 'success', message: '예능 일정이 수정되었습니다.' })
      );
      navigate('/admin/schedule');
    } catch (err) {
      setToast({ type: 'error', message: err.message || '수정에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center">
          <span className="text-[14.5px] text-mute">로딩 중...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="mx-auto w-full max-w-[880px] px-10 pb-[90px] pt-[52px]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <AdminPageHeader crumb="ADMIN / SCHEDULE / EDIT" solid="EDIT " outline="VARIETY" />
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
          onSubmit={handleSubmit}
          className="mt-10"
        >
          {/* 프로그램 정보 */}
          <div className={F.section}>PROGRAM</div>
          <div className="mt-[22px] grid grid-cols-2 gap-x-7 gap-y-[26px]">
            <div className="col-span-2">
              <label className={F.label}>프로그램명 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 워크돌 EP.15"
                className={`${F.underline} mt-1.5`}
              />
            </div>
            <div className="col-span-2">
              <label className={F.label}>방송사 / 플랫폼 *</label>
              <input
                type="text"
                value={broadcaster}
                onChange={(e) => setBroadcaster(e.target.value)}
                placeholder="방송사 또는 플랫폼명"
                className={`${F.underline} mt-1.5`}
              />
              {broadcasterPresets.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {broadcasterPresets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setBroadcaster(p)}
                      className={`border px-3 py-1.5 text-[13px] font-bold transition-colors ${
                        broadcaster === p
                          ? 'border-ink bg-ink text-white'
                          : 'border-hairline bg-white text-esub hover:border-ink'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className={F.label}>날짜 *</label>
              <div className="mt-2.5">
                <DatePicker value={date} onChange={setDate} />
              </div>
            </div>
            <div>
              <label className={F.label}>시간 (선택)</label>
              <div className="mt-2.5">
                <TimePicker value={time} onChange={setTime} />
              </div>
            </div>
          </div>

          {/* 추가 정보 */}
          <div className={`${F.section} mt-11`}>EXTRA</div>
          <div className="mt-[22px] space-y-[26px]">
            <div>
              <label className={F.label}>다시보기 링크 (선택)</label>
              <input
                type="url"
                value={replayUrl}
                onChange={(e) => setReplayUrl(e.target.value)}
                placeholder="https://..."
                className={`${F.underlineSm} mt-1.5`}
              />
            </div>
            <div>
              <label className={F.label}>썸네일 이미지 (선택)</label>
              {thumbnailPreview ? (
                <div className="relative mt-2.5 inline-block">
                  <img
                    src={thumbnailPreview}
                    alt="미리보기"
                    className="h-36 border border-hairline object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setThumbnailFile(null);
                      setThumbnailPreview(null);
                      setRemoveThumbnail(true);
                    }}
                    className="absolute -right-2.5 -top-2.5 flex h-6 w-6 items-center justify-center bg-ink text-[13px] text-white transition-colors hover:bg-[#C0392B]"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label className={`${F.dropzone} mt-2.5 h-36 w-full`}>
                  <Image size={20} className="text-faint" />
                  <span className="text-[13px]">클릭하여 이미지 선택</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (f) {
                        setThumbnailFile(f);
                        setRemoveThumbnail(false);
                        const r = new FileReader();
                        r.onloadend = () => setThumbnailPreview(r.result);
                        r.readAsDataURL(f);
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* 버튼 */}
          <div className={F.footer}>
            <button type="button" onClick={() => navigate('/admin/schedule')} className={F.btn}>
              취소
            </button>
            <button type="submit" disabled={saving} className={F.btnInk}>
              {saving ? '수정 중...' : '수정하기'}
            </button>
          </div>
        </motion.form>
      </div>
    </AdminLayout>
  );
}

export default VarietyEditForm;
