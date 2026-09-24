/**
 * 행사(대학 축제 등) 일정 추가 폼 — 에디토리얼 리뉴얼
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MapPin, X, Image as ImageIcon } from 'lucide-react';

import Toast from '@/components/common/Toast';
import DatePicker from '@/components/pc/admin/common/DatePicker';
import TimePicker from '@/components/pc/admin/common/TimePicker';
import PosterPreviews from '@/components/pc/admin/schedule/PosterPreviews';
import PosterAddButton from '@/components/pc/admin/schedule/PosterAddButton';
import LocationSearchDialog from '@/components/pc/admin/schedule/LocationSearchDialog';
import { F } from '@/components/pc/admin';
import { useToast } from '@/hooks/common';
import { createEvent } from '@/api/admin/events';
import { invalidateSchedules } from '@/utils';

// 세부 타입 목록 (현재는 "대학"만)
const SUBTYPES = [
  { value: 'university', label: '대학 축제' },
  { value: 'general', label: '일반 행사' },
];

function EventForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast, setToast } = useToast();

  // 공통 상태
  const [subtype, setSubtype] = useState('university');
  const [title, setTitle] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState(null);
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const [posterFiles, setPosterFiles] = useState([]); // [{file, preview}]
  const [postUrls, setPostUrls] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [saving, setSaving] = useState(false);

  // URL 추가/삭제
  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!postUrls.includes(url)) {
      setPostUrls([...postUrls, url]);
    }
    setUrlInput('');
  };
  const removeUrl = (index) => {
    setPostUrls(postUrls.filter((_, i) => i !== index));
  };

  // 제출
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      setToast({ type: 'error', message: '제목을 입력해주세요.' });
      return;
    }
    if (subtype === 'university' && !schoolName.trim()) {
      setToast({ type: 'error', message: '학교명을 입력해주세요.' });
      return;
    }
    if (!date) {
      setToast({ type: 'error', message: '날짜를 선택해주세요.' });
      return;
    }
    if (!venue) {
      setToast({ type: 'error', message: '장소를 선택해주세요.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        subtype,
        title: title.trim(),
        schoolName: schoolName.trim(),
        description: description.trim(),
        date,
        time: time || null,
        venue,
        postUrls,
      };

      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));
      posterFiles.forEach((item) => {
        formData.append('posters', item.file);
      });

      await createEvent(formData);

      // 쓰기가 끝난 자리에서 무효화 — 목록·공개 달력·상세·검색이 함께 갱신된다
      invalidateSchedules(queryClient);
      sessionStorage.setItem(
        'scheduleToast',
        JSON.stringify({ type: 'success', message: '행사 일정이 추가되었습니다.' })
      );
      navigate('/admin/schedule');
    } catch (err) {
      console.error('행사 저장 실패:', err);
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
        {/* 기본 정보 */}
        <div className={F.section}>EVENT INFO</div>
        <div className="mt-[22px] space-y-[26px]">
          {/* 세부 타입 */}
          <div>
            <label className={F.label}>세부 타입</label>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {SUBTYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSubtype(opt.value)}
                  className={F.chip(subtype === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className={F.label}>제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`${F.underline} mt-1.5`}
            />
          </div>

          {/* 학교명 — 대학 축제일 때만 */}
          {subtype === 'university' && (
            <div>
              <label className={F.label}>학교명 *</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className={`${F.underline} mt-1.5`}
              />
            </div>
          )}

          {/* 내용 (선택) — 멤버별 참여가 갈릴 때 적는다 */}
          <div>
            <label className={F.label}>내용 (선택)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${F.underline} mt-1.5 resize-none leading-relaxed`}
            />
          </div>
          {/* 날짜/시간 */}
          <div className="grid grid-cols-2 gap-7">
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

          {/* 장소 */}
          <div>
            <label className={F.label}>장소 *</label>
            {venue ? (
              <div className="mt-2.5 flex items-start gap-3 border border-hairline bg-white px-4 py-3.5">
                <MapPin size={15} className="mt-0.5 flex-shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-extrabold text-ink">{venue.name}</p>
                  {venue.address && <p className="mt-0.5 truncate text-[13.5px] text-mute">{venue.address}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setVenueDialogOpen(true)}
                  className="text-[13px] font-bold text-esub transition-colors hover:text-ink"
                >
                  변경
                </button>
                <button
                  type="button"
                  onClick={() => setVenue(null)}
                  className="text-faint transition-colors hover:text-[#C0392B]"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setVenueDialogOpen(true)}
                className={`${F.dropzone} mt-2.5 w-full py-3.5 text-[13.5px] font-bold`}
              >
                ◎ 장소 검색
              </button>
            )}
          </div>
        </div>

        {/* 포스터 */}
        <div className={`${F.section} mt-11`}>
          POSTERS <span className="ml-1.5 font-bold tracking-normal text-mute">선택 · 여러 장 가능</span>
        </div>
        <div className="mt-[18px] flex flex-wrap gap-2.5">
          <PosterPreviews items={posterFiles} setItems={setPosterFiles} />
          <PosterAddButton className={`${F.dropzone} h-32 w-32`} sourceUrls={[...postUrls, urlInput]} onAdd={(items) => setPosterFiles((previous) => [...previous, ...items])}>
            <ImageIcon size={18} className="text-faint" />
            <span className="text-[13px]">추가</span>
          </PosterAddButton>
        </div>

        {/* URL */}
        <div className={`${F.section} mt-11`}>
          LINKS <span className="ml-1.5 font-bold tracking-normal text-mute">선택 · 여러 개 가능</span>
        </div>
        <div className="mt-[18px] flex items-end gap-2.5">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addUrl();
              }
            }}
            placeholder="https://www.instagram.com/p/... 또는 공식 페이지"
            className={F.underlineSm}
          />
          <button
            type="button"
            onClick={addUrl}
            className="shrink-0 whitespace-nowrap border border-ink px-5 py-3 text-[13px] font-extrabold tracking-k15 text-ink transition-colors hover:bg-ink hover:text-white"
          >
            추가
          </button>
        </div>
        {postUrls.length > 0 && (
          <ul className="mt-3.5">
            {postUrls.map((url, idx) => (
              <li key={url} className="flex items-center justify-between gap-2 border-b border-hairline px-1 py-2.5">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 truncate text-[14px] font-semibold text-esub transition-colors hover:text-ink"
                >
                  {url}
                </a>
                <button
                  type="button"
                  onClick={() => removeUrl(idx)}
                  className="text-faint transition-colors hover:text-[#C0392B]"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

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

      {/* 장소 검색 다이얼로그 */}
      <LocationSearchDialog
        isOpen={venueDialogOpen}
        onClose={() => setVenueDialogOpen(false)}
        onSelect={(place) => setVenue(place)}
      />
    </>
  );
}

export default EventForm;
