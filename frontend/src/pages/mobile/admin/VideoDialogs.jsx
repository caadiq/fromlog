import ExpandSection from './ExpandSection';
import AnimatedDialog from './AnimatedDialog';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useDialogBackClose } from '@/hooks/common';
import { decodeHtmlEntities } from '@/utils';
import * as api from '@/api/admin/videos';
import useReviewViewport from './useReviewViewport';

export const categories = [['official', '본채널'], ['sp', '스프'], ['variety', '예능 · 기타'], ['music', '무대 · 퍼포먼스']];
export const categoryName = value => categories.find(([key]) => key === value)?.[1] || value;
const button = 'min-h-11 border border-hairline px-3 text-sm font-bold disabled:opacity-40';
function Choices({ value, options, onChange }) {
  return <div className="flex flex-wrap gap-2">{options.map(([key, label]) => <button key={key} aria-pressed={value === key} onClick={() => onChange(key)} className={`${button} ${value === key ? 'border-ink bg-ink text-white' : 'bg-white'}`}>{label}</button>)}</div>;
}
function Dialog({ open, title, onClose, busy, children, footer }) {
  const ref = useRef(null);
  useReviewViewport(ref, open);
  useDialogBackClose(open, onClose);
  useEffect(() => { if (open) ref.current?.querySelector('[data-review-scroll]')?.scrollTo(0, 0); }, [open]);
  return createPortal(<AnimatedDialog open={open} ref={ref} className="mobile-queue-review" aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}><div className="flex h-full flex-col bg-paper text-ink"><header className="flex shrink-0 items-center justify-between border-b border-hairline px-3 pt-[env(safe-area-inset-top)]"><span className="w-11" /><h2 className="text-lg font-extrabold">{title}</h2><button aria-label={`${title} 닫기`} disabled={busy} onClick={onClose} className="flex h-16 w-11 items-center justify-center"><X size={21} /></button></header><div data-review-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-none p-5">{children}</div><footer className="shrink-0 border-t border-hairline p-4 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</footer></div></AnimatedDialog>, document.body);
}
export function VideoFilters({ value, channels, onClose, onApply }) {
  const [draft, setDraft] = useState({ category: '', channel: '', type: '' });
  const [channelOpen, setChannelOpen] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => { if (value) { setDraft(value); setChannelOpen(false); setSearch(''); } }, [value]);
  const update = (key, next) => setDraft(previous => ({ ...previous, [key]: next }));
  return <Dialog open={Boolean(value)} title="영상 필터" onClose={onClose} footer={<div className="flex gap-2"><button className={button} onClick={() => { setDraft({ category: '', channel: '', type: '' }); setSearch(''); }}>초기화</button><button className="min-h-12 flex-1 bg-ink text-sm font-bold text-white" onClick={() => onApply(draft)}>적용하기</button></div>}><div className="space-y-7"><section><h3 className="mb-3 text-sm font-bold">카테고리</h3><Choices value={draft.category} options={[['', '전체'], ...categories]} onChange={value => update('category', value)} /></section><section><h3 className="mb-3 text-sm font-bold">채널</h3><button aria-label={draft.channel || '전체 채널'} aria-expanded={channelOpen} onClick={() => setChannelOpen(!channelOpen)} className={`${button} flex w-full items-center justify-between gap-3 bg-white text-left`}><span className="min-w-0 break-words">{draft.channel || '전체 채널'}</span><span>⌄</span></button><ExpandSection open={channelOpen}><div className="mt-2 border border-hairline bg-white p-2"><input aria-label="채널 검색" placeholder="채널 검색" value={search} onChange={event => setSearch(event.target.value)} className="mb-2 w-full border border-hairline p-3 text-base" /><div className="max-h-60 overflow-y-auto">{['', ...channels].filter(channel => !channel || channel.toLowerCase().includes(search.toLowerCase())).map(channel => <button key={channel} aria-pressed={draft.channel === channel} className={`min-h-11 w-full break-words px-3 py-2 text-left text-sm ${draft.channel === channel ? 'bg-ink text-white' : ''}`} onClick={() => { update('channel', channel); setChannelOpen(false); }}>{channel || '전체 채널'}</button>)}</div></div></ExpandSection></section><section><h3 className="mb-3 text-sm font-bold">형식</h3><Choices value={draft.type} options={[['', '전체'], ['video', '일반 영상'], ['shorts', 'SHORTS']]} onChange={value => update('type', value)} /></section></div></Dialog>;
}
export function VideoEditor({ value, onClose, onSuccess }) {
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState(null);
  const [category, setCategory] = useState('variety');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const lock = useRef(false);
  const editing = Boolean(value?.videoId);
  useEffect(() => { if (value) { setUrl(''); setPreview(null); setCategory(value.category || 'variety'); setError(''); } }, [value]);
  const close = () => { if (lock.current) return false; onClose(); };
  const lookup = async () => {
    if (lock.current || !url.trim()) return;
    lock.current = true; setBusy('lookup'); setError(''); setPreview(null);
    try { const result = await api.previewVideo(url.trim()); setPreview({ ...result, url: url.trim() }); setCategory(result.suggestedCategory || 'variety'); }
    catch (err) { setError(err.message || '영상 정보를 가져오지 못했습니다.'); }
    finally { lock.current = false; setBusy(''); }
  };
  const blocked = preview?.alreadyExists || preview?.beforeCutoff;
  const save = async () => {
    if (lock.current || (!editing && (!preview || blocked))) return;
    lock.current = true; setBusy('save'); setError('');
    try { if (editing) await api.updateVideo(value.videoId, { category }); else await api.createVideo({ url: preview.url, category }); onSuccess(editing ? '영상을 수정했습니다.' : '영상을 등록했습니다.'); onClose(); }
    catch (err) { setError(err.message || '저장하지 못했습니다.'); }
    finally { lock.current = false; setBusy(''); }
  };
  const video = editing ? value : preview;
  return <Dialog open={Boolean(value)} title={editing ? '영상 수정' : '영상 등록'} busy={Boolean(busy)} onClose={close} footer={<>{error && <p role="alert" className="mb-3 text-sm text-[#A93226]">{error}</p>}<div className="grid grid-cols-[1fr_2fr] gap-2"><button disabled={Boolean(busy)} onClick={close} className={button}>취소</button><button disabled={Boolean(busy) || (!editing && (!preview || blocked))} onClick={save} className="min-h-12 bg-ink text-sm font-bold text-white disabled:opacity-40">{busy === 'save' ? '저장 중...' : editing ? '저장' : '등록'}</button></div></>}><fieldset disabled={Boolean(busy)} className="min-w-0 space-y-5">
    {!editing && <div><label htmlFor="video-url" className="mb-2 block text-sm font-bold">YouTube URL</label><input id="video-url" type="url" value={url} placeholder="https://youtu.be/..." onChange={event => { setUrl(event.target.value); setPreview(null); setError(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); lookup(); } }} className="w-full border border-hairline bg-white p-3 text-base" /><button disabled={!url.trim() || Boolean(busy)} onClick={lookup} className={`${button} mt-2 w-full bg-white`}>{busy === 'lookup' ? '조회 중...' : '조회'}</button></div>}
    {video && <><div className="border border-hairline bg-white p-3"><img src={`https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`} alt="" className="mb-3 aspect-video w-full object-cover" /><h3 className="break-words text-base font-bold">{decodeHtmlEntities(video.title)}</h3><p className="mt-2 text-xs leading-relaxed text-mute">{video.channelName} · {video.publishedAt?.slice(0, 10)} · {video.videoType === 'shorts' ? 'SHORTS' : '일반 영상'}</p></div>{preview?.alreadyExists && <p className="text-sm text-[#A93226]">이미 등록된 영상입니다 ({categoryName(preview.existingCategory)})</p>}{preview?.beforeCutoff && <p className="text-sm text-[#A93226]">5인 체제(2025-01-26) 이전 영상은 등록할 수 없습니다.</p>}{!blocked && <section><h3 className="mb-3 text-sm font-bold">카테고리</h3>{!editing && video.videoType === 'shorts' ? <p className="text-sm">쇼츠는 카테고리와 무관하게 SHORTS에 표시됩니다.</p> : <Choices value={category} options={categories} onChange={setCategory} />}</section>}</>}
  </fieldset></Dialog>;
}
