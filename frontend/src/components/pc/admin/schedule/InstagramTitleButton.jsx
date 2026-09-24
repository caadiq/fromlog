import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Instagram, X } from 'lucide-react';
import { fetchAuthApi } from '@/api/client';
import { useDialogBackClose } from '@/hooks/common';

function findInstagramUrl(urls) {
  return urls.find(value => {
    try { return ['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(new URL(value).hostname); }
    catch { return false; }
  }) || '';
}

function TitleDialog({ initialUrl, onApply, onClose }) {
  const dialog = useRef(null);
  const request = useRef(null);
  const alive = useRef(true);
  const busy = useRef(false);
  const [url, setUrl] = useState(initialUrl);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    alive.current = true;
    dialog.current.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const viewport = window.visualViewport;
    const resize = () => {
      if (viewport && viewport.scale !== 1) return;
      const height = viewport?.height || window.innerHeight;
      dialog.current.style.top = `${(viewport?.offsetTop || 0) + height / 2}px`;
      dialog.current.style.maxHeight = `${Math.max(160, height - 24)}px`;
    };
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    resize();
    return () => {
      alive.current = false; request.current?.abort();
      document.body.style.overflow = previous;
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      window.removeEventListener('resize', resize);
    };
  }, []);
  const load = async () => {
    if (busy.current || !url.trim()) return;
    busy.current = true; setLoading(true); setError('');
    request.current = new AbortController();
    try {
      const result = await fetchAuthApi('/admin/instagram/caption', { method: 'POST', body: JSON.stringify({ url: url.trim() }), signal: request.current.signal });
      if (alive.current) setDraft(result.caption);
    } catch (err) { if (alive.current && err.name !== 'AbortError') setError(err.message); }
    finally { busy.current = false; if (alive.current) setLoading(false); }
  };
  const apply = () => {
    const title = draft.replace(/\s+/g, ' ').trim();
    if (!title || busy.current) return;
    if (title.length > 500) { setError('제목을 500자 이내로 정리해주세요.'); return; }
    onApply(title); onClose();
  };
  return createPortal(<dialog ref={dialog} aria-labelledby="instagram-title-heading" onCancel={event => { event.preventDefault(); onClose(); }}
    className="fixed bottom-auto left-0 right-0 m-0 mx-auto flex-col overflow-hidden border border-ink bg-white p-0 text-ink backdrop:bg-black/50 open:flex"
    style={{ width: 'min(560px, calc(100vw - 32px))', transform: 'translateY(-50%)' }}>
    <header className="flex shrink-0 items-center justify-between border-b border-hairline px-5 py-3">
      <h2 id="instagram-title-heading" className="break-keep text-[18px] font-extrabold leading-snug">인스타그램에서 제목 가져오기</h2>
      <button type="button" aria-label="제목 가져오기 닫기" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center"><X size={20} /></button>
    </header>
    <div className="min-h-0 overflow-y-auto overscroll-none p-5">
      <label className="block text-sm font-bold" htmlFor="instagram-title-url">인스타그램 게시글 링크</label>
      <input id="instagram-title-url" type="url" value={url} disabled={loading} onChange={event => { setUrl(event.target.value); setDraft(''); setError(''); }} placeholder="https://www.instagram.com/p/..." className="mt-2 w-full min-w-0 border border-hairline px-3 py-3 text-base outline-none focus:border-ink" />
      <label className="mb-2 mt-5 block text-sm font-bold" htmlFor="instagram-title-draft">제목으로 사용할 내용</label>
      <textarea id="instagram-title-draft" value={draft} disabled={loading} onChange={event => { setDraft(event.target.value); setError(''); }} rows={7} placeholder="게시글 본문을 가져온 뒤, 원하는 일정 제목만 남겨주세요." className="w-full resize-y border border-hairline p-3 text-base leading-relaxed outline-none focus:border-ink" />
      <p className="mt-2 text-[13px] leading-relaxed text-mute">입력하기를 누르면 일정 제목에 반영됩니다. 줄바꿈은 공백으로 바뀝니다.</p>
      {error && <p role="alert" className="mt-3 text-sm text-[#A93226]">{error}</p>}
    </div>
    <footer className="flex shrink-0 justify-end gap-2 border-t border-hairline p-5">
      <button type="button" onClick={onClose} className="min-h-11 border border-hairline px-5 text-sm font-bold">취소</button>
      <button type="button" disabled={loading || (!draft.trim() && !url.trim())} onClick={draft.trim() ? apply : load} className="min-h-11 bg-ink px-5 text-sm font-bold text-white disabled:opacity-40">{loading ? '가져오는 중...' : draft.trim() ? '입력하기' : '가져오기'}</button>
    </footer>
  </dialog>, document.body);
}

export default function InstagramTitleButton({ sourceUrls = [], onApply, disabled = false }) {
  const [open, setOpen] = useState(false);
  useDialogBackClose(open, () => setOpen(false));
  return <>
    <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="flex min-h-10 shrink-0 items-center gap-1.5 border border-hairline bg-white px-2.5 text-[13px] font-semibold tracking-normal text-esub transition-colors hover:border-ink disabled:opacity-40"><Instagram size={15} />인스타에서 가져오기</button>
    {open && <TitleDialog initialUrl={findInstagramUrl(sourceUrls)} onApply={onApply} onClose={() => setOpen(false)} />}
  </>;
}
