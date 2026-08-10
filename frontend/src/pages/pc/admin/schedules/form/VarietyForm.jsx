/**
 * 예능 일정 추가 폼 — 에디토리얼 리뉴얼
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Image } from 'lucide-react';

import Toast from '@/components/common/Toast';
import DatePicker from '@/components/pc/admin/common/DatePicker';
import TimePicker from '@/components/pc/admin/common/TimePicker';
import { F } from '@/components/pc/admin';
import { useToast } from '@/hooks/common';
import { useAdminAuth } from '@/hooks/pc/admin';
import { createVarietySchedule, getBroadcasters } from '@/api/admin/variety';

function VarietyForm() {
  const navigate = useNavigate();
  const { toast, setToast } = useToast();
  const { isAuthenticated } = useAdminAuth();

  // 폼 상태
  const [title, setTitle] = useState('');
  const [broadcaster, setBroadcaster] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [replayUrl, setReplayUrl] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  // 자주 사용된 방송사 목록
  const { data: broadcasterPresets = [] } = useQuery({
    queryKey: ['broadcasters'],
    queryFn: getBroadcasters,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  // 폼 제출
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      setToast({ type: 'error', message: '프로그램명을 입력해주세요.' });
      return;
    }
    if (!broadcaster.trim()) {
      setToast({ type: 'error', message: '방송사/플랫폼을 선택하거나 입력해주세요.' });
      return;
    }
    if (!date) {
      setToast({ type: 'error', message: '날짜를 선택해주세요.' });
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

      await createVarietySchedule(formData);

      sessionStorage.setItem(
        'scheduleToast',
        JSON.stringify({ type: 'success', message: '예능 일정이 추가되었습니다.' })
      );
      navigate('/admin/schedule');
    } catch (err) {
      console.error('예능 일정 저장 실패:', err);
      setToast({ type: 'error', message: err.message || '저장에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Toast toast={toast} onClose={() => setToast(null)} />

      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={handleSubmit}
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
                {broadcasterPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBroadcaster(preset)}
                    className={`border px-3 py-1.5 text-[13px] font-bold transition-colors ${
                      broadcaster === preset
                        ? 'border-ink bg-ink text-white'
                        : 'border-hairline bg-white text-esub hover:border-ink'
                    }`}
                  >
                    {preset}
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
              placeholder="https://www.youtube.com/watch?v=... 또는 OTT 링크"
              className={`${F.underlineSm} mt-1.5`}
            />
          </div>

          <div>
            <label className={F.label}>썸네일 이미지 (선택)</label>
            {thumbnailPreview ? (
              <div className="relative mt-2.5 inline-block">
                <img
                  src={thumbnailPreview}
                  alt="썸네일 미리보기"
                  className="h-36 border border-hairline object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setThumbnailFile(null);
                    setThumbnailPreview(null);
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
                    const file = e.target.files[0];
                    if (file) {
                      setThumbnailFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setThumbnailPreview(reader.result);
                      reader.readAsDataURL(file);
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
            {saving ? '저장 중...' : '일정 추가'}
          </button>
        </div>
      </motion.form>
    </>
  );
}

export default VarietyForm;
