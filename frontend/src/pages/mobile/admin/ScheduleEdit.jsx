import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X, ImagePlus, MapPin } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { decodeHtmlEntities, invalidateSchedules } from '@/utils';
import { getCategoryInfo } from '@/utils/schedule';
import { fetchAuthApi } from '@/api/client';
import { getSchedule } from '@/api/admin/schedules';
import { getEvent, updateEvent } from '@/api/admin/events';
import { getEtc, updateEtc } from '@/api/admin/etc';
import { getVarietySchedule, updateVarietySchedule } from '@/api/admin/variety';
import CustomSelect from '@/components/pc/admin/common/CustomSelect';
import DatePicker from '@/components/pc/admin/common/DatePicker';
import TimePicker from '@/components/pc/admin/common/TimePicker';
import YearMonthPicker from '@/components/pc/admin/common/YearMonthPicker';
import LocationSearchDialog from '@/components/pc/admin/schedule/LocationSearchDialog';
import InstagramTitleButton from '@/components/pc/admin/schedule/InstagramTitleButton';
import PosterAddButton from '@/components/pc/admin/schedule/PosterAddButton';
import PosterPreviews from '@/components/pc/admin/schedule/PosterPreviews';
import useReviewViewport from './useReviewViewport';

const editors = {
  행사: { load: getEvent, save: updateEvent, cache: 'event-schedule' },
  기타: { load: getEtc, save: updateEtc, cache: 'etc-schedule' },
  예능: { load: getVarietySchedule, save: updateVarietySchedule, cache: 'variety-schedule' },
  유튜브: { load: getSchedule, save: (id, body) => fetchAuthApi(`/admin/youtube/schedule/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), cache: 'schedule' },
};
export function canEditSchedule(item) {
  return Boolean(editors[getCategoryInfo(item).name]) && /^\d+$/.test(String(item.id)) && !item.is_birthday && !item.is_debut && !item.is_anniversary;
}
const inputClass = 'mt-2 w-full border border-hairline bg-white px-3 py-3 text-base outline-none focus:border-ink';
const buttonClass = 'min-h-11 border border-hairline px-3 text-sm font-semibold disabled:opacity-40';
const validUrl = value => {
  const url = value.trim();
  if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error('http 또는 https 링크를 입력해주세요.');
  return url;
};

// Mount a fresh editor for each selection; ignore late reads after closing it.
export default function ScheduleEdit({ item, onClose, onSuccess, onBusyChange }) {
  const dialog = useRef(null);
  const busy = useRef(false);
  const category = getCategoryInfo(item).name;
  const editor = editors[category];
  const detail = category === '행사' || category === '기타';
  const youtube = category === '유튜브';
  const monthOnly = item.datePrecision === 'month';
  const client = useQueryClient();
  const revealPicker = useReviewViewport(dialog, true);
  const [form, setForm] = useState(null);
  const [existing, setExisting] = useState([]);
  const [posters, setPosters] = useState([]);
  const [thumbnail, setThumbnail] = useState([]);
  const [originalThumbnail, setOriginalThumbnail] = useState('');
  const [links, setLinks] = useState([]);
  const [url, setUrl] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [monthYear, setMonthYear] = useState(2026);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const close = () => { if (!busy.current) onClose(); };
  useEffect(() => { dialog.current.showModal(); }, []);
  useEffect(() => {
    let alive = true;
    setLoading(true); setLoadError('');
    if (!canEditSchedule(item)) { setLoading(false); setLoadError('모바일 수정이 지원되지 않는 일정입니다.'); return; }
    editor.load(item.id).then(data => {
      if (!alive) return;
      setForm({ ...data, title: decodeHtmlEntities(data.title || ''), date: data.date?.slice(0, 10) || '', time: data.time?.slice(0, 5) || '', description: data.description || '', broadcaster: data.broadcaster || '', schoolName: data.schoolName || '', subtype: data.subtype || 'general', replayUrl: data.replayUrl || '', videoType: data.videoType || 'video' });
      setExisting((data.posters || []).map(p => ({ id: p.id, preview: p.mediumUrl || p.thumbUrl || p.originalUrl })));
      setLinks(data.postUrls || []);
      setOriginalThumbnail(data.thumbnailUrl || '');
      setThumbnail(data.thumbnailUrl ? [{ id: 'existing-thumbnail', preview: data.thumbnailUrl }] : []);
    }).catch(err => { if (alive) setLoadError(err.message || '일정을 불러오지 못했습니다.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [item.id, editor, attempt]);
  const update = (field, value) => setForm(previous => ({ ...previous, [field]: value }));
  const addLink = () => {
    if (!url.trim()) return;
    try { const link = validUrl(url); setLinks(previous => [...new Set([...previous, link])]); setUrl(''); setError(''); }
    catch { setError('올바른 게시글 링크를 입력해주세요.'); }
  };
  const submit = async () => {
    if (busy.current || loading || !form || loadError) return;
    setError('');
    if (!youtube && (!form.title.trim() || !form.date)) { setError('제목과 날짜를 입력해주세요.'); return; }
    if (category === '행사' && form.subtype === 'university' && !form.schoolName.trim()) { setError('학교명을 입력해주세요.'); return; }
    if (category === '예능' && !form.broadcaster.trim()) { setError('방송사 / 플랫폼을 입력해주세요.'); return; }
    let body;
    try {
      if (youtube) body = { videoType: form.videoType };
      else {
        body = new FormData();
        if (detail) {
          const postUrls = [...new Set([...links, ...(url.trim() ? [url] : [])].map(validUrl))];
          body.append('payload', JSON.stringify({ title: form.title.trim(), date: form.date, time: form.time || null, description: form.description.trim(), subtype: form.subtype, schoolName: form.schoolName.trim(), venue: form.venue || null, postUrls, keepPosterIds: existing.map(p => p.id) }));
          posters.forEach(p => body.append('posters', p.file));
        } else {
          if (form.replayUrl.trim()) validUrl(form.replayUrl);
          for (const field of ['title', 'date', 'time', 'description', 'broadcaster', 'replayUrl']) body.append(field, form[field].trim());
          if (thumbnail[0]?.file) body.append('thumbnail', thumbnail[0].file);
          else if (originalThumbnail && !thumbnail.length) body.append('removeThumbnail', 'true');
        }
      }
    } catch { setError('올바른 http 또는 https 링크를 입력해주세요.'); return; }
    busy.current = true; setSaving(true); onBusyChange(true);
    try {
      await editor.save(item.id, body);
      client.removeQueries({ queryKey: [editor.cache, String(item.id)] });
      client.removeQueries({ queryKey: [editor.cache, Number(item.id)] });
      invalidateSchedules(client);
      client.invalidateQueries({ queryKey: ['admin', 'mobile'] });
      client.invalidateQueries({ queryKey: ['admin', 'logs'] });
      if (category === '예능') client.invalidateQueries({ queryKey: ['broadcasters'] });
      onSuccess({ date: form.date, monthOnly });
    } catch (err) { setError(err.message || '저장하지 못했습니다. 다시 시도해주세요.'); }
    finally { busy.current = false; setSaving(false); onBusyChange(false); }
  };

  return createPortal(<dialog ref={dialog} aria-labelledby="schedule-edit-title" className="mobile-queue-review" onCancel={event => { event.preventDefault(); if (locationOpen) setLocationOpen(false); else close(); }}>
    <div className="flex h-full flex-col bg-white text-ink">
      <header className="flex shrink-0 items-center justify-between border-b border-hairline px-3 pb-2 pt-[max(8px,env(safe-area-inset-top))]">
        <button type="button" aria-label="일정 목록으로 돌아가기" disabled={saving} onClick={close} className="flex h-12 w-12 items-center justify-center disabled:opacity-40"><ArrowLeft size={21} /></button>
        <h2 id="schedule-edit-title" className="text-lg font-extrabold">일정 수정</h2>
        <button type="button" aria-label="수정 닫기" disabled={saving} onClick={close} className="flex h-12 w-12 items-center justify-center disabled:opacity-40"><X size={21} /></button>
      </header>
      <div data-review-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-none p-5">
        {loading ? <p role="status" className="py-12 text-center text-sm text-mute">일정을 불러오는 중...</p> : loadError ? <div role="alert" className="text-sm text-[#A93226]">{loadError}<button className={`${buttonClass} mt-3 block`} onClick={() => setAttempt(value => value + 1)}>다시 시도</button></div> : form && <fieldset disabled={saving} className="min-w-0 space-y-5">
          <p className="text-sm font-bold text-mute">{category}{category === '행사' && form.subtype === 'university' ? ' · 대학 축제' : ''}</p>
          {youtube ? <>
            <h3 className="break-words text-lg font-extrabold">{form.title}</h3>
            <p className="text-sm text-mute">{form.channelName}<br />{form.date} {form.time}</p>
            <p className="text-sm leading-relaxed text-mute">영상 유형을 수정할 수 있습니다. 제목과 업로드 날짜는 영상 정보를 따릅니다.</p>
            <div><span className="mb-2 block text-sm font-bold">영상 유형</span><CustomSelect value={form.videoType} onChange={value => update('videoType', value)} options={[{ value: 'video', label: '일반 영상' }, { value: 'shorts', label: '쇼츠' }]} /></div>
          </> : <>
            <div><label htmlFor="edit-title" className="block text-sm font-bold">일정 제목 *</label><div className="mt-2 flex items-start gap-2"><input id="edit-title" maxLength={500} value={form.title} onChange={event => update('title', event.target.value)} className={`${inputClass.replace('mt-2 ', '')} min-w-0 flex-1`} />{category === '행사' && <InstagramTitleButton iconOnly sourceUrls={[...links, url]} disabled={saving} onApply={title => update('title', title)} />}</div></div>
            <div className="queue-review-date"><span className="mb-2 block text-sm font-bold">{monthOnly ? '예정 월 (날짜 미정)' : '날짜 *'}</span>{monthOnly ? <><button type="button" className={`${buttonClass} w-full`} onClick={() => { setMonthYear(Number(form.date.slice(0, 4))); setMonthOpen(!monthOpen); }}>{form.date.slice(0, 4)}년 {Number(form.date.slice(5, 7))}월 중</button><YearMonthPicker open={monthOpen} year={monthYear} month={Number(form.date.slice(5, 7)) - 1} onSelectYear={setMonthYear} onSelectMonth={value => { update('date', `${monthYear}-${String(value + 1).padStart(2, '0')}-01`); setMonthOpen(false); }} className="relative mt-2 w-full" /></> : <DatePicker inline onOpen={revealPicker} value={form.date} onChange={value => update('date', value)} />}</div>
            {!monthOnly && <div><div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold">시간</span>{form.time && <button type="button" onClick={() => update('time', '')} className="min-h-11 px-2 text-sm text-mute">시간 미정으로 변경</button>}</div><TimePicker inline onOpen={revealPicker} value={form.time} placeholder="시간 미정" onChange={value => update('time', value)} /></div>}
            {category === '행사' && <>
              <div><span className="mb-2 block text-sm font-bold">행사 유형</span><CustomSelect value={form.subtype} onChange={value => update('subtype', value)} options={[{ value: 'university', label: '대학 축제' }, { value: 'general', label: '일반 행사' }]} /></div>
              {form.subtype === 'university' && <label className="block text-sm font-bold">학교 *<input value={form.schoolName} onChange={event => update('schoolName', event.target.value)} className={inputClass} /></label>}
            </>}
            {category === '예능' && <label className="block text-sm font-bold">방송사 / 플랫폼 *<input value={form.broadcaster} onChange={event => update('broadcaster', event.target.value)} className={inputClass} /></label>}
            {detail && <div><span className="mb-2 block text-sm font-bold">장소</span>{form.venue && <p className="mb-2 break-words text-sm">{form.venue.name}<span className="mt-1 block text-mute">{form.venue.address}</span></p>}<div className="flex gap-2"><button type="button" onClick={() => setLocationOpen(true)} className={`${buttonClass} flex flex-1 items-center justify-center gap-2`}><MapPin size={17} />장소 검색</button>{form.venue && <button type="button" onClick={() => update('venue', null)} className={buttonClass}>삭제</button>}</div></div>}
            <label className="block text-sm font-bold">내용 (선택)<textarea value={form.description} onChange={event => update('description', event.target.value)} rows={3} className={inputClass} /></label>
            {detail && <>
              <div><span className="mb-3 block text-sm font-bold">포스터</span>{existing.length > 0 && <div className="mb-3 flex flex-wrap gap-3"><PosterPreviews items={existing} setItems={setExisting} sizeClass="h-28 w-20" /></div>}<div className="flex flex-wrap gap-3"><PosterPreviews items={posters} setItems={setPosters} sizeClass="h-28 w-20" /><PosterAddButton disabled={existing.length + posters.length >= 20} maxCount={Math.max(1, 20 - existing.length - posters.length)} sourceUrls={[...links, url]} onAdd={items => setPosters(previous => [...previous, ...items])} className="flex h-28 w-20 flex-col items-center justify-center gap-2 border border-dashed border-hairline text-sm text-mute disabled:opacity-40"><ImagePlus size={22} />추가</PosterAddButton></div>{posters.length > 0 && <p className="mt-2 text-xs text-mute">새 포스터는 기존 포스터 뒤에 추가됩니다.</p>}</div>
              <div><label className="block text-sm font-bold">게시글 링크<input type="url" value={url} onChange={event => setUrl(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addLink(); } }} placeholder="인스타그램 등 출처 링크" className={inputClass} /></label><button type="button" onClick={addLink} className={`${buttonClass} mt-2 w-full`}>링크 추가</button>{links.map(link => <div key={link} className="mt-2 flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 break-all">{link}</span><button type="button" aria-label={`${link} 삭제`} onClick={() => setLinks(previous => previous.filter(value => value !== link))} className="flex h-11 w-11 shrink-0 items-center justify-center"><X size={17} /></button></div>)}</div>
            </>}
            {category === '예능' && <>
              <label className="block text-sm font-bold">다시보기 링크<input type="url" value={form.replayUrl} onChange={event => update('replayUrl', event.target.value)} className={inputClass} /></label>
              <div><span className="mb-3 block text-sm font-bold">썸네일</span><div className="flex flex-wrap gap-3"><PosterPreviews items={thumbnail} setItems={setThumbnail} sizeClass="h-28 w-40" />{!thumbnail.length && <PosterAddButton maxCount={1} onAdd={setThumbnail} className={`${buttonClass} flex h-28 w-40 items-center justify-center gap-2`}><ImagePlus size={22} />추가</PosterAddButton>}</div></div>
            </>}
          </>}
        </fieldset>}
      </div>
      <footer className="shrink-0 border-t border-hairline bg-white px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {error && <p role="alert" className="mb-3 max-h-24 overflow-y-auto text-sm leading-relaxed text-[#A93226]">{error}</p>}
        <div className="grid grid-cols-[1fr_2fr] gap-2"><button type="button" disabled={saving} onClick={close} className={buttonClass}>취소</button><button type="button" disabled={saving || loading || Boolean(loadError) || !form} onClick={submit} className="min-h-12 bg-ink px-3 text-sm font-bold text-white disabled:opacity-40">{saving ? '저장 중...' : '저장하기'}</button></div>
      </footer>
      <LocationSearchDialog isOpen={locationOpen} onClose={() => setLocationOpen(false)} onSelect={venue => update('venue', venue)} />
    </div>
  </dialog>, document.body);
}
