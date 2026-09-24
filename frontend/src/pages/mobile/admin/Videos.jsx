import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useDocumentTitle, useToast } from '@/hooks/common';
import { Toast } from '@/components/common';
import ConfirmDialog from '@/components/pc/admin/common/ConfirmDialog';
import { decodeHtmlEntities } from '@/utils';
import * as api from '@/api/admin/videos';
import MobileAdminLayout from './Layout';
import { VideoFilters, VideoEditor, categoryName } from './VideoDialogs';

const LIMIT = 20;
const button = 'flex min-h-11 items-center justify-center border border-hairline px-3 text-sm font-bold disabled:opacity-40';
export default function MobileAdminVideos() {
  useDocumentTitle('영상 관리');
  return <MobileAdminLayout flush><VideosContent /></MobileAdminLayout>;
}
function VideosContent() {
  const client = useQueryClient();
  const [params, setParams] = useState({ category: '', channel: '', type: '', q: '', page: 1 });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(null);
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [editingPage, setEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState('');
  const [pageError, setPageError] = useState('');
  const list = useRef(null);
  const surface = useRef(null);
  const { toast, showSuccess, hideToast } = useToast();
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      if (!surface.current || (viewport && viewport.scale !== 1)) return;
      const bottom = (viewport?.height || window.innerHeight) + (viewport?.offsetTop || 0);
      surface.current.style.height = `${Math.max(160, bottom - surface.current.getBoundingClientRect().top)}px`;
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    return () => { viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize); window.removeEventListener('resize', resize); };
  }, []);
  const query = useQuery({ queryKey: ['admin', 'videos', 'mobile', params], queryFn: () => api.getVideos({ category: params.category, channel: params.channel, type: params.type, q: params.q, limit: LIMIT, offset: (params.page - 1) * LIMIT }) });
  const total = query.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const videos = query.data?.videos || [];
  useEffect(() => {
    const timer = setTimeout(() => setParams(previous => previous.q === search.trim() ? previous : { ...previous, q: search.trim(), page: 1 }), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => { list.current?.scrollTo(0, 0); setEditingPage(false); setPageError(''); }, [params]);
  useEffect(() => { if (query.isSuccess && params.page > totalPages) setParams(previous => ({ ...previous, page: totalPages })); }, [query.isSuccess, totalPages, params.page]);
  const goToPage = page => { setParams(previous => ({ ...previous, page })); setEditingPage(false); setPageError(''); };
  const submitPage = event => {
    event.preventDefault();
    const page = Number(pageInput);
    if (!/^\d+$/.test(pageInput) || !Number.isSafeInteger(page) || page < 1 || page > totalPages) { setPageError(`1~${totalPages} 사이의 페이지를 입력해주세요.`); return; }
    goToPage(page);
  };
  const refresh = message => {
    client.invalidateQueries({ queryKey: ['admin', 'videos'] });
    client.invalidateQueries({ queryKey: ['videos'] });
    client.invalidateQueries({ queryKey: ['videosHome'] });
    client.invalidateQueries({ queryKey: ['admin', 'logs'] });
    client.invalidateQueries({ queryKey: ['admin', 'mobile'] });
    showSuccess(message);
  };
  const remove = async () => {
    if (lock.current || !deleting) return;
    lock.current = true; setBusy(true); setError('');
    try { await api.deleteVideo(deleting.videoId); setDeleting(null); refresh('영상을 삭제했습니다.'); }
    catch (err) { setError(err.message || '삭제하지 못했습니다.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const hasFilters = Boolean(params.category || params.channel || params.type);
  return <div ref={surface} className="flex min-h-0 w-full shrink-0 flex-col">
    <Toast toast={toast} onClose={hideToast} />
    <section aria-label="영상 검색과 필터" className="max-h-[50%] shrink-0 overflow-y-auto overscroll-none border-b border-hairline bg-paper px-4 pb-4 pt-5">
      <h1 className="mb-4 text-[26px] font-extrabold">영상 관리</h1><p className="my-3 text-xs font-bold text-green-deep">{query.isSuccess ? `전체 ${total.toLocaleString()}건` : query.isError ? '조회 실패' : '조회 중...'}</p>
      <div className="flex gap-2"><div className="flex min-w-0 flex-1 items-center gap-2 border border-hairline bg-white px-3"><Search size={18} className="shrink-0 text-mute" /><input type="search" aria-label="제목 검색" placeholder="제목 검색" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none [&::-webkit-search-cancel-button]:hidden" />{search && <button aria-label="검색어 지우기" onClick={() => setSearch('')} className="h-11 shrink-0"><X size={17} /></button>}</div><button aria-label={hasFilters ? '상세 필터 · 적용됨' : '상세 필터'} onClick={() => setFilter(params)} className={`${button} relative w-12 shrink-0 bg-white`}><SlidersHorizontal size={19} />{hasFilters && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />}</button></div>
    </section>
    <div className="relative min-h-0 flex-1"><div ref={list} data-video-scroll className="h-full overflow-y-auto overscroll-none px-4 pb-24 pt-4" aria-busy={query.isFetching}>
      {query.isPending ? <p role="status" className="py-16 text-center text-sm text-mute">영상을 불러오는 중...</p> : query.isError ? <div role="alert" className="py-10 text-sm text-[#A93226]">영상을 불러오지 못했습니다.<button onClick={() => query.refetch()} className={`${button} mt-3`}>다시 시도</button></div> : !videos.length ? <p role="status" className="py-16 text-center text-sm text-mute">선택한 조건에 맞는 영상이 없습니다.</p> : <ul aria-label="영상 목록" className="space-y-3">{videos.map(video => <li key={video.videoId} className="rounded-[3px] border border-hairline bg-white p-3">
        <a href={video.videoType === 'shorts' ? `https://www.youtube.com/shorts/${video.videoId}` : `https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noopener noreferrer" aria-label={`${decodeHtmlEntities(video.title)} · YouTube에서 보기`} className="flex items-start gap-3">
          <div className="flex h-[63px] w-28 shrink-0 items-center justify-center overflow-hidden border border-hairline bg-faint-light">
            <img src={`https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`} alt="" loading="lazy" className={video.videoType === 'shorts' ? 'h-full w-auto aspect-[9/16] object-cover' : 'h-full w-full object-cover'} />
          </div>
          <div className="min-w-0 flex-1"><h2 className="line-clamp-2 break-words text-sm font-bold leading-snug">{decodeHtmlEntities(video.title)}</h2><p className="mt-1 truncate text-xs text-mute">{video.channelName}</p></div>
        </a>
        <div className="mt-2 flex items-center justify-between gap-2"><time className="rounded bg-[#F3F4F3] px-1.5 py-1 text-xs font-bold text-esub">{video.publishedAt?.slice(0, 10).replaceAll('-', '. ')}</time><span className="rounded bg-green-soft px-1.5 py-1 text-xs font-bold text-green-deep">{video.videoType === 'shorts' ? 'SHORTS' : categoryName(video.category)}</span></div>
        <div className="mt-2 grid grid-cols-[1fr_72px] gap-2"><button onClick={() => setEditor(video)} className={`${button} bg-white`}>수정</button><button onClick={() => { setError(''); setDeleting(video); }} className={`${button} bg-white`}>삭제</button></div>
      </li>)}</ul>}
    </div><button aria-label="영상 추가" onClick={() => setEditor({})} className="absolute bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-[0_6px_18px_rgba(0,0,0,0.3),0_2px_6px_rgba(0,0,0,0.2)]"><Plus size={27} /></button></div>
    <nav aria-label="영상 페이지 이동" className="shrink-0 border-t border-hairline bg-paper px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      {pageError && <p role="alert" className="mb-2 text-center text-xs text-[#A93226]">{pageError}</p>}
      <div className="flex items-center justify-between gap-2"><button aria-label="이전 페이지" disabled={params.page <= 1 || !query.isSuccess || query.isFetching} onClick={() => goToPage(params.page - 1)} className={`${button} gap-1 bg-white !px-2`}><ChevronLeft size={15} />이전</button>
        {editingPage ? <form onSubmit={submitPage} className="flex min-w-0 items-center gap-1"><input autoFocus aria-label="이동할 페이지" inputMode="numeric" enterKeyHint="go" value={pageInput} onChange={event => { setPageInput(event.target.value); setPageError(''); }} onKeyDown={event => { if (event.key === 'Escape') { setEditingPage(false); setPageError(''); } }} className="h-11 w-12 border border-ink bg-white text-center text-base" /><span className="text-xs text-mute">/ {totalPages}</span><button disabled={!query.isSuccess || query.isFetching} className="h-11 px-2 text-sm font-bold">이동</button></form> : <button aria-label={`현재 ${params.page}페이지, 전체 ${totalPages}페이지. 페이지 직접 입력`} disabled={!query.isSuccess || !total} onClick={() => { setPageInput(String(params.page)); setEditingPage(true); }} className="min-h-11 px-3 text-sm font-bold underline decoration-hairline underline-offset-4">{params.page} <span className="font-normal text-mute">/ {totalPages}</span></button>}
        <button aria-label="다음 페이지" disabled={params.page >= totalPages || !query.isSuccess || query.isFetching} onClick={() => goToPage(params.page + 1)} className={`${button} gap-1 bg-white !px-2`}>다음<ChevronRight size={15} /></button></div>
      <p className="mt-2 text-center text-xs text-mute">{query.isSuccess ? `${total ? (params.page - 1) * LIMIT + 1 : 0}–${Math.min(params.page * LIMIT, total)} / ${total.toLocaleString()}건 · 최신순` : '한 페이지에 20건씩 표시'}</p>
    </nav>
    <VideoFilters value={filter} channels={query.data?.channels || []} onClose={() => setFilter(null)} onApply={draft => { setParams(previous => ({ ...previous, category: draft.category, channel: draft.channel, type: draft.type, page: 1 })); setFilter(null); }} />
    <VideoEditor value={editor} onClose={() => setEditor(null)} onSuccess={refresh} />
    <ConfirmDialog isOpen={Boolean(deleting)} onClose={() => { if (!lock.current) setDeleting(null); }} onConfirm={remove} loading={busy} title="영상 삭제" confirmText="삭제하기" message={<><p className="break-words">“{decodeHtmlEntities(deleting?.title || '')}” 영상을 아카이브에서 삭제할까요?</p>{error && <p role="alert" className="mt-2 text-[#A93226]">{error}</p>}</>} />
  </div>;
}
