import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/common';
import { getLogs, getLogCategories } from '@/api/admin/logs';
import { decodeHtmlEntities, getTodayKST } from '@/utils';
import { CATEGORY_LABELS, ACTION_STYLES } from '@/components/pc/admin/log/constants';
import MobileAdminLayout from './Layout';
import { LogDetail, LogFilters, actionName, logDate, periodRange } from './LogDialogs';

const LIMIT = 20;
const button = 'flex min-h-11 items-center justify-center border border-hairline px-3 text-sm font-bold disabled:opacity-40';
const dateText = value => value.replaceAll('-', '. ');

export default function MobileAdminLogs() {
  useDocumentTitle('활동 로그');
  return <MobileAdminLayout flush><LogsContent /></MobileAdminLayout>;
}

function LogsContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [params, setParams] = useState(() => ({ ...periodRange(1), page: 1, limit: LIMIT, category: '', actor: searchParams.get('actor') === 'bot' ? 'bot' : '', action: searchParams.get('action') === 'error' ? 'error' : '', search: '' }));
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [editingPage, setEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState('');
  const [pageError, setPageError] = useState('');
  const list = useRef(null);
  const surface = useRef(null);
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
  const query = useQuery({ queryKey: ['admin', 'logs', 'mobile', params], queryFn: () => getLogs(params) });
  const categories = useQuery({ queryKey: ['admin', 'logs', 'categories'], queryFn: getLogCategories, staleTime: 5 * 60 * 1000 });
  const total = query.data?.total || 0;
  const totalPages = Math.max(1, query.data?.totalPages || 0);
  const logs = query.data?.logs || [];
  const change = values => { setParams(previous => ({ ...previous, ...values, page: 1 })); setEditingPage(false); setPageError(''); };
  useEffect(() => {
    const timer = setTimeout(() => setParams(previous => previous.search === search.trim() ? previous : { ...previous, search: search.trim(), page: 1 }), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    list.current?.scrollTo(0, 0);
    setEditingPage(false); setPageError('');
  }, [params]);
  useEffect(() => {
    if (query.isSuccess && params.page > totalPages) setParams(previous => ({ ...previous, page: totalPages }));
  }, [query.isSuccess, totalPages, params.page]);
  useEffect(() => {
    const log = location.state?.log;
    if (!log) return;
    const day = logDate(log.created_at).slice(0, 10);
    setParams(previous => ({ ...previous, from: day, to: day, page: 1 }));
    setSelectedLog(log);
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate]);
  const goToPage = page => { setParams(previous => ({ ...previous, page })); setEditingPage(false); setPageError(''); list.current?.scrollTo(0, 0); };
  const submitPage = event => {
    event.preventDefault();
    const page = Number(pageInput);
    if (!/^\d+$/.test(pageInput) || !Number.isSafeInteger(page) || page < 1 || page > totalPages) { setPageError(`1~${totalPages} 사이의 페이지를 입력해주세요.`); return; }
    goToPage(page);
  };
  const hasFilters = Boolean(params.category || params.actor || params.action || params.from !== getTodayKST() || params.to !== getTodayKST());

  return <div ref={surface} className="flex min-h-0 w-full shrink-0 flex-col">
    <section className="max-h-[50%] shrink-0 overflow-y-auto overscroll-none border-b border-hairline bg-paper px-4 pb-4 pt-5" aria-label="활동 로그 검색과 필터">
      <h1 className="mb-4 text-[26px] font-extrabold">활동 로그</h1>
      <div className="my-3 flex flex-wrap items-center justify-between gap-1 text-xs text-mute"><span>{dateText(params.from)}{params.to !== params.from && ` — ${dateText(params.to)}`}</span><span className="font-bold text-green-deep">{query.isSuccess ? `전체 ${total.toLocaleString()}건` : query.isError ? '조회 실패' : '조회 중...'}</span></div>
      <div className="flex gap-2"><div className="flex min-w-0 flex-1 items-center gap-2 border border-hairline bg-white px-3"><Search size={18} className="shrink-0 text-mute" /><input type="search" aria-label="활동 내용 검색" placeholder="활동 내용 검색" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none [&::-webkit-search-cancel-button]:hidden" />{search && <button aria-label="검색어 지우기" onClick={() => setSearch('')} className="h-11 shrink-0"><X size={17} /></button>}</div><button aria-label={hasFilters ? '상세 필터 · 적용됨' : '상세 필터'} onClick={() => setFilter(params)} className={`${button} relative w-12 shrink-0 bg-white`}><SlidersHorizontal size={19} />{hasFilters && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />}</button></div>

    </section>
    <div ref={list} data-log-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-none px-4 pb-5" aria-busy={query.isFetching}>
      {query.isPending ? <p role="status" className="py-16 text-center text-sm text-mute">활동 로그를 불러오는 중...</p> : query.isError ? <div role="alert" className="py-10 text-sm text-[#A93226]">로그를 불러오지 못했습니다.<button onClick={() => query.refetch()} className={`${button} mt-3`}>다시 시도</button></div> : logs.length === 0 ? <p role="status" className="py-16 text-center text-sm text-mute">선택한 조건에 맞는 활동이 없습니다.</p> : <ul aria-label="활동 로그 목록">{logs.map((log, index) => {
        const day = logDate(log.created_at).slice(0, 10);
        const newDay = index === 0 || day !== logDate(logs[index - 1].created_at).slice(0, 10);
        return <li key={log.id}>{newDay && <h2 className="mb-3 mt-5 flex items-center gap-3 text-xs font-bold text-mute">{day === getTodayKST() ? '오늘 · ' : ''}{dateText(day)}<span className="h-px flex-1 bg-hairline" /></h2>}
          <button onClick={() => setSelectedLog(log)} className={`mb-3 block w-full rounded-[3px] border border-hairline bg-white p-3.5 text-left ${log.action === 'error' ? 'border-l-[3px] border-l-[#B25448]' : ''}`}>
            <span className="mb-2 flex items-center justify-between gap-3"><span className={`rounded px-1.5 py-1 text-xs font-bold ${ACTION_STYLES[log.action] || 'bg-faint-light text-esub'}`}>{actionName(log.action)}</span><time className="text-xs text-mute">{logDate(log.created_at).slice(11, 16)}</time></span>
            <span className="flex items-center gap-2"><span className="min-w-0 flex-1 break-words text-sm font-bold leading-relaxed">{decodeHtmlEntities(log.summary)}</span><ChevronRight size={17} className="shrink-0 text-mute" /></span><span className="mt-2 block text-xs text-mute">{log.actor === 'admin' ? '관리자' : '봇'} · {CATEGORY_LABELS[log.category] || log.category}</span>
          </button></li>;
      })}</ul>}
    </div>
    <nav aria-label="로그 페이지 이동" className="shrink-0 border-t border-hairline bg-paper px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      {pageError && <p role="alert" className="mb-2 text-center text-xs text-[#A93226]">{pageError}</p>}
      <div className="flex items-center justify-between gap-2"><button aria-label="이전 페이지" disabled={params.page <= 1 || !query.isSuccess || query.isFetching} onClick={() => goToPage(params.page - 1)} className={`${button} gap-1 bg-white !px-2`}><ChevronLeft size={15} />이전</button>
        {editingPage ? <form onSubmit={submitPage} className="flex min-w-0 items-center gap-1"><input autoFocus aria-label="이동할 페이지" inputMode="numeric" enterKeyHint="go" value={pageInput} onChange={event => { setPageInput(event.target.value); setPageError(''); }} onKeyDown={event => { if (event.key === 'Escape') { setEditingPage(false); setPageError(''); } }} className="h-11 w-12 border border-ink bg-white text-center text-base" /><span className="text-xs text-mute">/ {totalPages}</span><button disabled={!query.isSuccess || query.isFetching} className="h-11 px-2 text-sm font-bold">이동</button></form> : <button aria-label={`현재 ${params.page}페이지, 전체 ${totalPages}페이지. 페이지 직접 입력`} disabled={!query.isSuccess || !total} onClick={() => { setPageInput(String(params.page)); setEditingPage(true); }} className="min-h-11 px-3 text-sm font-bold underline decoration-hairline underline-offset-4">{params.page} <span className="font-normal text-mute">/ {totalPages}</span></button>}
        <button aria-label="다음 페이지" disabled={params.page >= totalPages || !query.isSuccess || query.isFetching} onClick={() => goToPage(params.page + 1)} className={`${button} gap-1 bg-white !px-2`}>다음<ChevronRight size={15} /></button></div>
      <p className="mt-2 text-center text-xs text-mute">{query.isSuccess ? `${total ? (params.page - 1) * LIMIT + 1 : 0}–${Math.min(params.page * LIMIT, total)} / ${total.toLocaleString()}건 · 최신순` : '한 페이지에 20건씩 표시'}</p>
    </nav>
    <LogFilters value={filter} categories={categories.data?.categories || []} categoryError={categories.isError} onRetry={() => categories.refetch()} onClose={() => setFilter(null)} onApply={draft => { change({ from: draft.from, to: draft.to, actor: draft.actor, category: draft.category, action: draft.action }); setFilter(null); }} />
    <LogDetail log={selectedLog} onClose={() => setSelectedLog(null)} />
  </div>;
}
