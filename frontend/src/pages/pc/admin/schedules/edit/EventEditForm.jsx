/**
 * 행사 일정 수정 폼 — 에디토리얼 리뉴얼
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MapPin, X, Image as ImageIcon } from 'lucide-react';

import AdminLayout from '@/components/pc/admin/layout/Layout';
import Toast from '@/components/common/Toast';
import DatePicker from '@/components/pc/admin/common/DatePicker';
import TimePicker from '@/components/pc/admin/common/TimePicker';
import LocationSearchDialog from '@/components/pc/admin/schedule/LocationSearchDialog';
import { AdminPageHeader, F } from '@/components/pc/admin';
import { useToast, useDocumentTitle } from '@/hooks/common';
import { useAdminAuth } from '@/hooks/pc/admin';
import { EASE } from '@/components/editorial';
import { getEvent, updateEvent } from '@/api/admin/events';

const SUBTYPES = [
  { value: 'university', label: '대학 축제' },
  { value: 'general', label: '일반 행사' },
];

function EventEditForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast, setToast } = useToast();
  const { isAuthenticated } = useAdminAuth();
  useDocumentTitle('일정 수정');

  const { data: eventData, isLoading } = useQuery({
    queryKey: ['event-schedule', id],
    queryFn: () => getEvent(id),
    enabled: isAuthenticated && !!id,
  });

  const [subtype, setSubtype] = useState('university');
  const [title, setTitle] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venue, setVenue] = useState(null);
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const [existingPosters, setExistingPosters] = useState([]); // [{id, mediumUrl}]
  const [keepPosterIds, setKeepPosterIds] = useState([]);
  const [newPosterFiles, setNewPosterFiles] = useState([]); // [{file, preview}]
  const [postUrls, setPostUrls] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (eventData && !initialized) {
      setSubtype(eventData.subtype || 'university');
      setTitle(eventData.title || '');
      setSchoolName(eventData.schoolName || '');
      setDate(eventData.date || '');
      setTime(eventData.time || '');
      setVenue(eventData.venue || null);
      setExistingPosters(eventData.posters || []);
      setKeepPosterIds((eventData.posters || []).map((p) => p.id));
      setPostUrls(eventData.postUrls || []);
      setInitialized(true);
    }
  }, [eventData, initialized]);

  // 포스터
  const handlePosterChange = (e) => {
    const files = Array.from(e.target.files || []);
    const newItems = files.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ file, preview: reader.result });
        reader.readAsDataURL(file);
      });
    });
    Promise.all(newItems).then((items) => {
      setNewPosterFiles((prev) => [...prev, ...items]);
    });
    e.target.value = '';
  };
  const removeExistingPoster = (posterId) => {
    setKeepPosterIds((prev) => prev.filter((id) => id !== posterId));
    setExistingPosters((prev) => prev.filter((p) => p.id !== posterId));
  };
  const removeNewPoster = (index) => {
    setNewPosterFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // URL
  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!postUrls.includes(url)) setPostUrls([...postUrls, url]);
    setUrlInput('');
  };
  const removeUrl = (index) => {
    setPostUrls(postUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim() || !date || !venue || (subtype === 'university' && !schoolName.trim())) {
      setToast({ type: 'error', message: '필수 항목을 입력해주세요.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        subtype,
        title: title.trim(),
        schoolName: schoolName.trim(),
        date,
        time: time || null,
        venue,
        postUrls,
        keepPosterIds,
      };

      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));
      newPosterFiles.forEach((item) => {
        formData.append('posters', item.file);
      });

      await updateEvent(id, formData);
      // 캐시 제거 — 남겨두면 다음에 수정 화면을 열 때 저장 전 값이 채워진다
      queryClient.removeQueries({ queryKey: ['event-schedule', id] });
      sessionStorage.setItem(
        'scheduleToast',
        JSON.stringify({ type: 'success', message: '행사 일정이 수정되었습니다.' })
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
          <AdminPageHeader crumb="ADMIN / SCHEDULE / EDIT" solid="EDIT " outline="EVENT" />
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
          onSubmit={handleSubmit}
          className="mt-10"
        >
          {/* 기본 정보 */}
          <div className={F.section}>EVENT INFO</div>
          <div className="mt-[22px] space-y-[26px]">
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

            <div>
              <label className={F.label}>제목 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`${F.underline} mt-1.5`}
              />
            </div>

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
            {existingPosters.map((p) => (
              <div key={`e-${p.id}`} className="relative">
                <img
                  src={p.mediumUrl || p.thumbUrl}
                  alt={`poster ${p.id}`}
                  className="h-32 w-32 border border-hairline object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeExistingPoster(p.id)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center bg-ink text-[13px] text-white transition-colors hover:bg-[#C0392B]"
                >
                  ✕
                </button>
              </div>
            ))}
            {newPosterFiles.map((item, idx) => (
              <div key={`n-${idx}`} className="relative">
                <img
                  src={item.preview}
                  alt={`new poster ${idx}`}
                  className="h-32 w-32 border border-hairline object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeNewPoster(idx)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center bg-ink text-[13px] text-white transition-colors hover:bg-[#C0392B]"
                >
                  ✕
                </button>
              </div>
            ))}
            <label className={`${F.dropzone} h-32 w-32`}>
              <ImageIcon size={18} className="text-faint" />
              <span className="text-[13px]">추가</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handlePosterChange} />
            </label>
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
              placeholder="https://..."
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
                <li key={idx} className="flex items-center justify-between gap-2 border-b border-hairline px-1 py-2.5">
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
              {saving ? '수정 중...' : '수정하기'}
            </button>
          </div>
        </motion.form>
      </div>

      <LocationSearchDialog
        isOpen={venueDialogOpen}
        onClose={() => setVenueDialogOpen(false)}
        onSelect={(place) => setVenue(place)}
      />
    </AdminLayout>
  );
}

export default EventEditForm;
