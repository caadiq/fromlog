import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useDialogBackClose } from '@/hooks/common';
import { decodeHtmlEntities, getTodayKST } from '@/utils';
import DatePicker from '@/components/pc/admin/common/DatePicker';
import { CATEGORY_LABELS, ACTION_LABELS, ACTION_STYLES } from '@/components/pc/admin/log/constants';
import useReviewViewport from './useReviewViewport';

export function periodRange(days) {
  const to = getTodayKST();
  const from = new Date(`${to}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - days + 1);
  return { from: from.toISOString().slice(0, 10), to };
}

export const logDate = value => String(value || '').replace('T', ' ').slice(0, 19);
export const actionName = value => value === 'error' ? '오류' : ACTION_LABELS[value] || value;
const button = 'min-h-11 border border-hairline px-3 text-sm font-bold';
const chip = selected => `${button} ${selected ? 'border-ink bg-ink text-white' : 'bg-white'}`;

function LogDialog({ open, title, onClose, children, footer, dialogRef }) {
  useDialogBackClose(open, onClose);
  useEffect(() => { if (open) dialogRef.current?.showModal(); else dialogRef.current?.close(); }, [open, dialogRef]);
  return createPortal(<dialog ref={dialogRef} className="mobile-queue-review" aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="flex h-full flex-col bg-paper text-ink">
      <header className="flex shrink-0 items-center justify-between border-b border-hairline px-3 pt-[env(safe-area-inset-top)]">
        <span aria-hidden="true" className="w-11 shrink-0" /><h2 className="text-lg font-extrabold">{title}</h2><button aria-label={`${title} 닫기`} onClick={onClose} className="flex h-16 w-11 items-center justify-center"><X size={21} /></button>
      </header>
      <div data-review-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-none p-5">{children}</div>
      <footer className="shrink-0 border-t border-hairline p-4 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</footer>
    </div>
  </dialog>, document.body);
}

export function LogFilters({ value, categories, categoryError, onRetry, onClose, onApply }) {
  const dialog = useRef(null);
  const revealPicker = useReviewViewport(dialog, Boolean(value));
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { if (value) { setDraft({ ...value }); setError(''); } }, [value]);
  const update = (key, next) => { setDraft(previous => ({ ...previous, [key]: next })); setError(''); };
  const activePeriod = draft && [1, 7, 30].find(days => {
    const range = periodRange(days);
    return range.from === draft.from && range.to === draft.to;
  });
  const apply = () => {
    if (!draft.from || !draft.to || draft.from > draft.to) { setError('시작 날짜가 종료 날짜보다 늦지 않도록 선택해주세요.'); return; }
    onApply(draft);
  };
  return <LogDialog open={Boolean(value)} title="로그 필터" dialogRef={dialog} onClose={onClose} footer={<><p role={error ? 'alert' : undefined} className="mb-2 text-sm text-[#A93226]">{error}</p><div className="flex gap-2"><button className={button} onClick={() => { setDraft({ from: getTodayKST(), to: getTodayKST(), actor: '', action: '', category: '' }); setError(''); }}>초기화</button><button onClick={apply} className="min-h-12 flex-1 bg-ink text-sm font-bold text-white">적용하기</button></div></>}>
    {draft && <div className="space-y-7">
      <section><h3 className="mb-3 text-sm font-bold">조회 기간</h3><div className="mb-4 grid grid-cols-3 gap-2">{[[1, '오늘'], [7, '최근 7일'], [30, '최근 30일']].map(([days, label]) => <button key={days} aria-pressed={activePeriod === days} className={chip(activePeriod === days)} onClick={() => { setDraft(previous => ({ ...previous, ...periodRange(days) })); setError(''); }}>{label}</button>)}</div><div className="space-y-3"><div><span className="mb-2 block text-xs text-mute">시작 날짜</span><DatePicker inline onOpen={revealPicker} value={draft.from} onChange={date => update('from', date)} /></div><div><span className="mb-2 block text-xs text-mute">종료 날짜</span><DatePicker inline onOpen={revealPicker} value={draft.to} onChange={date => update('to', date)} /></div></div></section>
      <section><h3 className="mb-3 text-sm font-bold">분류</h3>{categoryError && <p className="mb-2 text-sm text-[#A93226]">분류를 불러오지 못했습니다. <button onClick={onRetry} className="underline">다시 시도</button></p>}<div className="flex flex-wrap gap-2"><button className={chip(!draft.category)} aria-pressed={!draft.category} onClick={() => update('category', '')}>전체</button>{categories.map(category => { const selected = draft.category.split(',').includes(category); return <button key={category} aria-pressed={selected} className={chip(selected)} onClick={() => update('category', (selected ? draft.category.split(',').filter(c => c !== category) : [...draft.category.split(',').filter(Boolean), category]).join(','))}>{CATEGORY_LABELS[category] || category}</button>; })}</div></section>
      <section><h3 className="mb-3 text-sm font-bold">행위자</h3><div className="flex gap-2">{[['', '전체 행위자'], ['admin', '관리자'], ['bot', '봇']].map(([value, label]) => <button key={value} aria-pressed={draft.actor === value} className={chip(draft.actor === value)} onClick={() => update('actor', value)}>{label}</button>)}</div></section>
      <section><h3 className="mb-3 text-sm font-bold">오류 필터</h3><div className="flex gap-2">{[['', '모든 활동'], ['error', '오류만']].map(([value, label]) => <button key={value} aria-pressed={draft.action === value} className={chip(draft.action === value)} onClick={() => update('action', value)}>{label}</button>)}</div></section>
    </div>}
  </LogDialog>;
}

export function LogDetail({ log, onClose }) {
  const dialog = useRef(null);
  useReviewViewport(dialog, Boolean(log));
  const details = log?.details;
  const targetLabel = ({ schedule: '일정', event_schedule: '행사 일정', etc_schedule: '기타 일정', youtube_schedule: '유튜브 일정', x_schedule: 'X 일정', variety_schedule: '예능 일정', album: '앨범', member: '멤버', bot: '봇' })[log?.target_type] || '항목';
  const errorMessage = details?.error?.message || details?.error || details?.message;
  const scheduleTarget = log?.action !== 'delete' && ['schedule', 'event_schedule', 'etc_schedule', 'youtube_schedule', 'x_schedule', 'variety_schedule'].includes(log?.target_type) && log?.target_id;
  return <LogDialog open={Boolean(log)} title="활동 상세" dialogRef={dialog} onClose={onClose} footer={<button onClick={onClose} className="min-h-12 w-full bg-ink text-sm font-bold text-white">닫기</button>}>
    {log && <>
      <span className={`rounded px-2 py-1 text-xs font-bold ${ACTION_STYLES[log.action] || 'bg-faint-light text-esub'}`}>{actionName(log.action)}</span>
      <h3 className="mt-4 break-words text-xl font-extrabold leading-relaxed">{decodeHtmlEntities(log.summary)}</h3><p className="mt-2 text-sm text-mute">{logDate(log.created_at)}</p>
      <dl className="mt-6 text-sm">{[['행위자', log.actor === 'admin' ? '관리자' : `봇 · ${log.actor}`], ['분류', CATEGORY_LABELS[log.category] || log.category], ['대상', [log.target_type && targetLabel, log.target_id && `#${log.target_id}`].filter(Boolean).join(' ')]].map(([key, value]) => value && <div key={key} className="flex gap-4 border-b border-hairline py-4"><dt className="w-20 shrink-0 text-mute">{key}</dt><dd className="min-w-0 break-words">{value}</dd></div>)}</dl>
      {log.action === 'error' && typeof errorMessage === 'string' && <section className="mt-6"><h4 className="mb-3 text-sm font-bold">오류 내용</h4><p className="whitespace-pre-wrap break-words border border-[#E5B8B3] bg-[#F9E9E7] p-4 text-sm leading-relaxed text-[#A93226]">{errorMessage}</p></section>}
      {scheduleTarget && <Link to={`/schedule/${log.target_id}`} className={`${button} mt-6 flex items-center justify-between`}>관련 일정 보기<span>↗</span></Link>}
      {details && <details className="mt-6 border-t border-hairline pt-4"><summary className="cursor-pointer py-2 text-sm font-bold">원본 기록 보기</summary><pre className="mt-3 whitespace-pre-wrap break-all bg-white p-3 text-xs leading-relaxed">{JSON.stringify(details, null, 2)}</pre></details>}
    </>}
  </LogDialog>;
}
