import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialogBackClose } from '@/hooks/common';
import { getTodayKST } from '@/utils';
import DatePicker from '@/components/pc/admin/common/DatePicker';
import TimePicker from '@/components/pc/admin/common/TimePicker';
import useReviewViewport from './useReviewViewport';

const button = 'min-h-11 border border-hairline px-3 text-sm font-bold disabled:opacity-40';
export default function LinkEditor({ item, busy, saveError, onClose, onSave }) {
  const dialog = useRef(null);
  const revealPicker = useReviewViewport(dialog, Boolean(item));
  const [form, setForm] = useState({ title: '', url: '', startsAt: '', endsAt: '', enabled: true });
  const [error, setError] = useState('');
  useDialogBackClose(Boolean(item), onClose);
  useEffect(() => {
    if (!item) { dialog.current?.close(); return; }
    setForm({ title: item.title || '', url: item.url || '', startsAt: item.startsAt || '', endsAt: item.endsAt || '', enabled: item.enabled !== false });
    setError(''); dialog.current?.showModal();
    dialog.current?.querySelector('[data-review-scroll]')?.scrollTo(0, 0);
  }, [item]);
  const update = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); setError(''); };
  const submit = () => {
    if (busy) return;
    if (!form.title.trim()) return setError('제목을 입력해주세요.');
    try { const url = new URL(form.url.trim()); if (!['https:', 'http:'].includes(url.protocol)) throw Error(); }
    catch { return setError('올바른 http 또는 https URL을 입력해주세요.'); }
    if (form.startsAt && form.endsAt && form.startsAt > form.endsAt) return setError('종료일이 시작일보다 빠릅니다.');
    setError(''); onSave({ title: form.title.trim(), url: form.url.trim(), startsAt: form.startsAt || null, endsAt: form.endsAt || null, enabled: form.enabled });
  };
  return createPortal(<dialog ref={dialog} className="mobile-queue-review" aria-label={item?.id ? '링크 수정' : '링크 추가'} onCancel={event => { event.preventDefault(); onClose(); }}><div className="flex h-full flex-col bg-paper text-ink">
    <header className="flex shrink-0 items-center justify-between border-b border-hairline px-3 pt-[env(safe-area-inset-top)]"><span className="w-12" aria-hidden="true" /><h2 className="text-lg font-extrabold">{item?.id ? '링크 수정' : '링크 추가'}</h2><button aria-label="링크 편집 닫기" disabled={busy} onClick={onClose} className="flex h-16 w-12 items-center justify-center disabled:opacity-40"><X size={21} /></button></header>
    <div data-review-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-none p-5"><fieldset disabled={busy} className="min-w-0 space-y-6">
      <label className="block text-sm font-bold">제목<input value={form.title} maxLength={120} onChange={event => update('title', event.target.value)} placeholder="투표·스밍 안내" className="mt-2 w-full border border-hairline bg-white p-3 text-base outline-none focus:border-ink" /></label>
      <label className="block text-sm font-bold">URL<input type="url" value={form.url} maxLength={500} onChange={event => update('url', event.target.value)} placeholder="https://" className="mt-2 w-full border border-hairline bg-white p-3 text-base outline-none focus:border-ink" /></label>
      <div className="flex items-center justify-between gap-3 border-y border-hairline py-3"><div><h3 className="text-sm font-bold">공개 여부</h3><p className="mt-1 text-xs text-mute">공개하면 설정한 기간에 표시됩니다.</p></div><button type="button" role="switch" aria-label="공개 여부" aria-checked={form.enabled} onClick={() => update('enabled', !form.enabled)} className={`${button} shrink-0 ${form.enabled ? 'border-ink bg-ink text-white' : 'bg-white text-mute'}`}>{form.enabled ? '공개' : '숨김'}</button></div>
      {[['startsAt', '시작일 (선택)', '바로 표시', '00:00'], ['endsAt', '종료일 (선택)', '제한 없음', '23:59']].map(([key, label, empty, defaultTime]) => <section key={key}><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-bold">{label}</h3><button onClick={() => update(key, form[key] ? '' : `${getTodayKST()}T${defaultTime}`)} className="min-h-11 px-2 text-sm text-mute">{form[key] ? '설정 해제' : '설정'}</button></div>{form[key] ? <div className="space-y-3"><DatePicker inline onOpen={revealPicker} value={form[key].slice(0, 10)} onChange={value => update(key, `${value}T${form[key].slice(11, 16)}`)} /><TimePicker inline onOpen={revealPicker} value={form[key].slice(11, 16)} onChange={value => update(key, `${form[key].slice(0, 10)}T${value || defaultTime}`)} /></div> : <p className="border border-hairline bg-white p-3 text-sm text-mute">{empty}</p>}</section>)}
      <p className="text-xs leading-relaxed text-mute">한국 시간 기준입니다. 종료일이 지나면 사이트에서 자동으로 사라집니다. 숨김으로 바꿔도 제목과 표시 기간은 유지됩니다.</p>
    </fieldset></div>
    <footer className="shrink-0 border-t border-hairline p-4 pb-[max(16px,env(safe-area-inset-bottom))]">{(error || saveError) && <p role="alert" className="mb-3 text-sm text-[#A93226]">{error || saveError}</p>}<div className="grid grid-cols-[1fr_2fr] gap-2"><button disabled={busy} onClick={onClose} className={button}>취소</button><button disabled={busy} onClick={submit} className="min-h-12 bg-ink text-sm font-bold text-white disabled:opacity-40">{busy ? '저장 중...' : '저장'}</button></div></footer>
  </div></dialog>, document.body);
}
