/**
 * 기타(공용) 일정 추가 폼 — 라디오·뮤지컬 등. 장소·포스터·설명 지원 (모두 선택).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, X, Image as ImageIcon } from 'lucide-react';

import Toast from '@/components/common/Toast';
import DatePicker from '@/components/pc/admin/common/DatePicker';
import TimePicker from '@/components/pc/admin/common/TimePicker';
import LocationSearchDialog from '@/components/pc/admin/schedule/LocationSearchDialog';
import { F } from '@/components/pc/admin';
import { useToast } from '@/hooks/common';
import { createEtc } from '@/api/admin/etc';
import { uid } from '@/utils';

function EtcForm() {
  const navigate = useNavigate();
  const { toast, setToast } = useToast();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState(null);
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const [posterFiles, setPosterFiles] = useState([]); // [{id, file, preview}]
  const [postUrls, setPostUrls] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePosterChange = (e) => {
    const files = Array.from(e.target.files || []);
    const newItems = files.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ id: uid(), file, preview: reader.result });
        reader.readAsDataURL(file);
      });
    });
    Promise.all(newItems).then((items) => {
      setPosterFiles((prev) => [...prev, ...items]);
    });
    e.target.value = '';
  };
  const removePoster = (index) => {
    setPosterFiles((prev) => prev.filter((_, i) => i !== index));
  };

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

    if (!title.trim()) {
      setToast({ type: 'error', message: '제목을 입력해주세요.' });
      return;
    }
    if (!date) {
      setToast({ type: 'error', message: '날짜를 선택해주세요.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        date,
        time: time || null,
        description: description.trim(),
        venue,
        postUrls,
      };

      const formData = new FormData();
      formData.append('payload', JSON.stringify(payload));
      posterFiles.forEach((item) => {
        formData.append('posters', item.file);
      });

      await createEtc(formData);

      sessionStorage.setItem(
        'scheduleToast',
        JSON.stringify({ type: 'success', message: '기타 일정이 추가되었습니다.' })
      );
      navigate('/admin/schedule');
    } catch (err) {
      console.error('기타 저장 실패:', err);
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
        <div className={F.section}>ETC INFO</div>
        <div className="mt-[22px] space-y-[26px]">
          {/* 제목 */}
          <div>
            <label className={F.label}>제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 뮤지컬 <헬스키친> - 박지원 출연 / 라디오 게스트 출연"
              className={`${F.underline} mt-1.5`}
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

          {/* 설명 */}
          <div>
            <label className={F.label}>설명 (선택)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="예: 뮤지컬 <헬스키친> / 박지원 - 앨리(ALI) 역"
              className={`${F.underline} mt-1.5 resize-none leading-relaxed`}
            />
          </div>

          {/* 장소 (선택) */}
          <div>
            <label className={F.label}>장소 (선택)</label>
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
          {posterFiles.map((item, idx) => (
            <div key={item.id} className="relative">
              <img
                src={item.preview}
                alt={`poster ${idx}`}
                className="h-32 w-32 border border-hairline object-cover"
              />
              <button
                type="button"
                onClick={() => removePoster(idx)}
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
            placeholder="https://... 공식 페이지·예매처 등"
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

export default EtcForm;
