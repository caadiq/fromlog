import AnimatedDialog from './AnimatedDialog';
import { useEffect, useRef, useState } from 'react';
import useReviewViewport from './useReviewViewport';
import { createPortal } from 'react-dom';
import { X, ImagePlus, MapPin } from 'lucide-react';
import { useDialogBackClose } from '@/hooks/common';
import { registerPending } from '@/api/admin/pending';
import CustomSelect from '@/components/pc/admin/common/CustomSelect';
import DatePicker from '@/components/pc/admin/common/DatePicker';
import TimePicker from '@/components/pc/admin/common/TimePicker';
import LocationSearchDialog from '@/components/pc/admin/schedule/LocationSearchDialog';
import InstagramTitleButton from '@/components/pc/admin/schedule/InstagramTitleButton';
import PosterAddButton from '@/components/pc/admin/schedule/PosterAddButton';
import PosterPreviews from '@/components/pc/admin/schedule/PosterPreviews';

const SUPPORTED = ['행사', '기타', '예능', '유튜브'];
const CATEGORIES = [...SUPPORTED, '콘서트', '팬사인회', '티켓팅'];
const inputClass = 'mt-2 w-full border border-hairline bg-white px-3 py-3 text-base outline-none focus:border-ink';
const buttonClass = 'min-h-11 border border-hairline px-3 text-sm font-semibold';
const schoolName = title => String(title || '').match(/^(\S*(?:전문대학교|전문대학|대학교|대학))(?:\s+(\S*캠퍼스))?/)?.[0] || '';

export default function QueueReview({ item, onClose, onSuccess, onFailure, onBusyChange, onLinked }) {
  const dialog = useRef(null);
  const busy = useRef(false);
  const revealPicker = useReviewViewport(dialog, Boolean(item));
  const [form, setForm] = useState({});
  const [posters, setPosters] = useState([]);
  const [links, setLinks] = useState([]);
  const [url, setUrl] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useDialogBackClose(Boolean(item), onClose);
  useEffect(() => {
    if (!item) return;
    setForm({ ...item, title: item.title || '', date: item.date || '', time: item.time || '', description: item.description || '', schoolName: schoolName(item.title), subtype: schoolName(item.title) ? 'university' : 'general', broadcaster: '', venue: item.venueName ? { name: item.venueName } : null });
    setPosters([]); setLinks([]); setUrl(''); setError(''); setLocationOpen(false);
    dialog.current?.querySelector('[data-review-scroll]')?.scrollTo(0, 0);
  }, [item?.id]);
  const update = (field, value) => setForm(previous => ({ ...previous, [field]: value }));
  const detail = ['행사', '기타'].includes(form.category);
  const linked = Boolean(form.createdScheduleId);
  const supported = SUPPORTED.includes(form.category);
  const validatedLink = value => {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('http 또는 https 링크를 입력해주세요.');
    return value.trim();
  };
  const addLink = () => {
    if (!url.trim()) return;
    try { const value = validatedLink(url.trim()); setLinks(previous => previous.includes(value) ? previous : [...previous, value]); setUrl(''); setError(''); }
    catch { setError('올바른 게시글 링크를 입력해주세요.'); }
  };
  const submit = async () => {
    if (busy.current || !item) return;
    setError('');
    if (!linked && (!supported || !form.title.trim() || !form.date)) { setError('등록 가능한 카테고리와 제목, 날짜를 확인해주세요.'); return; }
    if (!linked && form.category === '예능' && !form.broadcaster.trim()) { setError('방송사 / 플랫폼을 입력해주세요.'); return; }
    if (!linked && form.category === '행사' && form.subtype === 'university' && !form.schoolName.trim()) { setError('학교명을 입력해주세요.'); return; }
    let postUrls = links;
    try { if (detail && url.trim()) postUrls = [...new Set([...links, validatedLink(url.trim())])]; }
    catch { setError('올바른 게시글 링크를 입력해주세요.'); return; }
    const targetId = item.id;
    const data = new FormData();
    data.append('payload', JSON.stringify({
      category: form.category, title: form.title.trim(), date: form.date, time: form.time || null,
      description: form.category === '유튜브' ? '' : form.description.trim(),
      broadcaster: form.category === '예능' ? form.broadcaster.trim() : '',
      subtype: form.subtype, schoolName: form.schoolName.trim(),
      venue: detail && Number.isFinite(form.venue?.lat) ? form.venue : null,
      venueName: detail && !Number.isFinite(form.venue?.lat) ? form.venue?.name || '' : '',
      postUrls: detail ? postUrls : [],
    }));
    if (detail) posters.forEach(poster => data.append('posters', poster.file));
    busy.current = true; setSaving(true); onBusyChange(true);
    try { await registerPending(targetId, data); onSuccess(targetId); }
    catch (err) {
      const message = err.message || '등록에 실패했습니다. 다시 시도해주세요.';
      setError(message); onFailure(message);
      if (err.data?.createdScheduleId) {
        setForm(previous => ({ ...previous, createdScheduleId: err.data.createdScheduleId }));
        onLinked(targetId, err.data.createdScheduleId);
      }
    } finally { busy.current = false; setSaving(false); onBusyChange(false); }
  };

  return createPortal(<AnimatedDialog open={Boolean(item)} ref={dialog} aria-labelledby="queue-review-title" className="mobile-queue-review" onCancel={event => { event.preventDefault(); if (!locationOpen) onClose(); else setLocationOpen(false); }}>
    <div className="flex h-full flex-col bg-white text-ink">
      <header className="flex shrink-0 items-center justify-between border-b border-hairline px-3 pb-2 pt-[max(8px,env(safe-area-inset-top))]">
        <span aria-hidden="true" className="w-12 shrink-0" />
        <h2 id="queue-review-title" className="text-lg font-extrabold">일정 등록</h2>
        <button type="button" aria-label="등록 닫기" onClick={onClose} className="flex h-12 w-12 items-center justify-center"><X size={21} /></button>
      </header>
      <div data-review-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-none p-5">
        <p className="mb-5 text-sm text-mute">큐에서 가져온 내용을 확인해주세요.</p>
        {item?.dupHint && <p className="mb-4 text-sm text-[#8A6D1B]">중복 확인 필요 · {item.dupHint}</p>}
        {item?.stale && <p className="mb-4 text-sm text-[#A93226]">최신 원문에서 사라진 일정입니다. 변경·취소 여부를 확인해주세요.</p>}
        {linked && <p className="mb-4 border border-hairline p-3 text-sm leading-relaxed">이미 저장된 일정의 등록을 마무리합니다. 제목·날짜 등은 변경되지 않으며, 포스터를 다시 첨부할 수 있습니다.</p>}
        <fieldset disabled={saving} className="min-w-0 space-y-5">
          <fieldset disabled={linked} className="min-w-0 space-y-5">
            <div><span className="mb-2 block text-sm font-bold">카테고리</span><CustomSelect value={form.category || ''} onChange={value => update('category', value)} options={CATEGORIES.map(value => ({ value, label: value }))} /></div>
            {!supported && <p role="status" className="text-sm leading-relaxed text-[#A93226]">{form.category}은 전용 일정 추가 폼에서 등록해주세요. 분류가 잘못 수집된 경우 카테고리를 변경할 수 있습니다.</p>}
            {form.category === '유튜브' && <p className="text-sm leading-relaxed text-mute">영상이 아직 없는 예정 일정으로 등록합니다. 영상이 올라오면 봇이 연결합니다.</p>}
            <div><label htmlFor="review-title" className="block text-sm font-bold">일정 제목 *</label><div className="mt-2 flex items-start gap-2"><input id="review-title" value={form.title || ''} onChange={event => update('title', event.target.value)} className={`${inputClass.replace('mt-2 ', '')} min-w-0 flex-1`} />{form.category === '행사' && <InstagramTitleButton iconOnly sourceUrls={[...links, url]} disabled={saving || linked} onApply={title => update('title', title)} />}</div></div>
            <div className="queue-review-date"><span className="mb-2 block text-sm font-bold">날짜 *</span><DatePicker inline onOpen={revealPicker} value={form.date || ''} onChange={value => update('date', value)} /></div>
            <div><div className="mb-2 flex items-center justify-between"><span className="text-sm font-bold">시간</span>{form.time && <button type="button" onClick={() => update('time', '')} className="min-h-11 px-2 text-sm text-mute">시간 미정으로 변경</button>}</div><TimePicker inline onOpen={revealPicker} value={form.time || ''} placeholder="시간 미정" onChange={value => update('time', value)} /></div>
            {form.category === '행사' && <>
              <div><span className="mb-2 block text-sm font-bold">행사 유형</span><CustomSelect value={form.subtype || 'general'} onChange={value => update('subtype', value)} options={[{ value: 'university', label: '대학 축제' }, { value: 'general', label: '일반 행사' }]} /></div>
              {form.subtype === 'university' && <label className="block text-sm font-bold">학교 *<input value={form.schoolName || ''} onChange={event => update('schoolName', event.target.value)} className={inputClass} /></label>}
            </>}
            {form.category === '예능' && <label className="block text-sm font-bold">방송사 / 플랫폼 *<input value={form.broadcaster || ''} onChange={event => update('broadcaster', event.target.value)} className={inputClass} /></label>}
            {detail && <div><span className="mb-2 block text-sm font-bold">장소</span>{form.venue && <p className="mb-2 break-words text-sm">{form.venue.name}<span className="mt-1 block text-mute">{form.venue.address || '수집된 장소명입니다. 검색하면 위치를 확인할 수 있습니다.'}</span></p>}<div className="flex gap-2"><button type="button" onClick={() => setLocationOpen(true)} className={`${buttonClass} flex flex-1 items-center justify-center gap-2`}><MapPin size={17} />장소 검색</button>{form.venue && <button type="button" onClick={() => update('venue', null)} className={buttonClass}>삭제</button>}</div></div>}
            {(detail || form.category === '예능') && <label className="block text-sm font-bold">내용 (선택)<textarea value={form.description || ''} onChange={event => update('description', event.target.value)} rows={3} className={inputClass} /></label>}
          </fieldset>
          {detail && <>
            <div><span className="mb-3 block text-sm font-bold">포스터</span><div className="flex flex-wrap gap-3"><PosterPreviews items={posters} setItems={setPosters} sizeClass="h-28 w-20" /><PosterAddButton sourceUrls={[...links, url]} onAdd={items => setPosters(previous => [...previous, ...items])} className="flex h-28 w-20 flex-col items-center justify-center gap-2 border border-dashed border-hairline text-sm text-mute"><ImagePlus size={22} />추가</PosterAddButton></div></div>
            <fieldset disabled={linked}><label className="block text-sm font-bold">게시글 링크<input type="url" value={url} onChange={event => setUrl(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addLink(); } }} placeholder="인스타그램 등 출처 링크" className={inputClass} /></label><button type="button" onClick={addLink} className={`${buttonClass} mt-2 w-full`}>링크 추가</button>{links.map(link => <div key={link} className="mt-2 flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 break-all">{link}</span><button type="button" aria-label={`${link} 삭제`} onClick={() => setLinks(previous => previous.filter(value => value !== link))} className="flex h-11 w-11 shrink-0 items-center justify-center"><X size={17} /></button></div>)}</fieldset>
          </>}
        </fieldset>
      </div>
      <footer className="shrink-0 border-t border-hairline bg-white px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {error && <p role="alert" className="mb-3 max-h-24 overflow-y-auto text-sm leading-relaxed text-[#A93226]">{error}</p>}
        <div className="grid grid-cols-[1fr_2fr] gap-2"><button type="button" onClick={onClose} className={buttonClass}>취소</button><button type="button" disabled={saving || (!supported && !linked)} onClick={submit} className="min-h-12 bg-ink px-3 text-sm font-bold text-white disabled:opacity-40">{saving ? '등록 중...' : linked ? '등록 마무리' : '일정 등록'}</button></div>
      </footer>
      <LocationSearchDialog isOpen={locationOpen} onClose={() => setLocationOpen(false)} onSelect={venue => update('venue', venue)} />
    </div>
  </AnimatedDialog>, document.body);
}
