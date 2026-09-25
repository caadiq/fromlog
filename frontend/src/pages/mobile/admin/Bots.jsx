import YouTubeBotDialog from '@/components/pc/admin/bot/YouTubeBotDialog';
import XBotDialog from '@/components/pc/admin/bot/XBotDialog';
import FestivalBotDialog from '@/components/pc/admin/bot/FestivalBotDialog';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, SlidersHorizontal, Play, Square, RefreshCw, Pencil, Trash2, X } from 'lucide-react';
import { useDocumentTitle, useDialogBackClose, useToast } from '@/hooks/common';
import { Toast } from '@/components/common';
import ConfirmDialog from '@/components/pc/admin/common/ConfirmDialog';
import { getBots, getQuotaWarning, startBot, stopBot, syncAllVideos, deleteYouTubeBot, deleteXBot, deleteFestivalBot } from '@/api/admin/bots';
import { formatIntervalMinutes } from '@/utils';
import { WEEKDAYS } from '@/constants';
import MobileAdminLayout from './Layout';
import useReviewViewport from './useReviewViewport';

const types = [['youtube', 'YouTube'], ['x', 'X'], ['festival', '일정 수집'], ['meilisearch', '검색 동기화']];
const statuses = [['running', '실행중'], ['stopped', '정지됨'], ['error', '오류']];
const statusStyle = { running: 'bg-green-soft text-green-deep', stopped: 'bg-[#F3F4F3] text-esub', error: 'bg-[#F9E9E7] text-[#A93226]' };
const button = 'min-h-11 border border-hairline px-3 text-sm font-bold';
function interval(bot) {
  const w = bot.weekly_schedule_config;
  if (w && w.dayOfWeek !== undefined && w.startTime) return `매주 ${WEEKDAYS[w.dayOfWeek] || '?'}요일 ${w.startTime} · ${w.intervalSeconds || 30}초 간격`;
  return bot.check_interval == null ? '—' : formatIntervalMinutes(bot.check_interval);
}
function lastCheck(value) {
  if (!value) return '기록 없음';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '기록 없음' : date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}
function Filters({ value, onClose, onApply }) {
  const ref = useRef(null);
  const [draft, setDraft] = useState({ type: '', status: '' });
  useReviewViewport(ref, Boolean(value));
  useDialogBackClose(Boolean(value), onClose);
  useEffect(() => { if (value) { setDraft(value); ref.current?.showModal(); } else ref.current?.close(); }, [value]);
  return createPortal(<dialog ref={ref} className="mobile-queue-review" aria-label="봇 필터" onCancel={event => { event.preventDefault(); onClose(); }}><div className="flex h-full flex-col bg-paper text-ink"><header className="flex shrink-0 items-center justify-between border-b border-hairline px-3 pt-[env(safe-area-inset-top)]"><span className="w-11" /><h2 className="text-lg font-extrabold">봇 필터</h2><button aria-label="봇 필터 닫기" onClick={onClose} className="flex h-16 w-11 items-center justify-center"><X size={21} /></button></header><div data-review-scroll className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-none p-5">{[['type', '봇 종류', types], ['status', '상태', statuses]].map(([key, label, options]) => <section key={key}><h3 className="mb-3 text-sm font-bold">{label}</h3><div className="flex flex-wrap gap-2">{[['', '전체'], ...options].map(([val, text]) => <button key={val} aria-pressed={draft[key] === val} onClick={() => setDraft(previous => ({ ...previous, [key]: val }))} className={`${button} ${draft[key] === val ? 'border-ink bg-ink text-white' : 'bg-white'}`}>{text}</button>)}</div></section>)}</div><footer className="flex shrink-0 gap-2 border-t border-hairline p-4 pb-[max(16px,env(safe-area-inset-bottom))]"><button className={button} onClick={() => setDraft({ type: '', status: '' })}>초기화</button><button className="min-h-12 flex-1 bg-ink text-sm font-bold text-white" onClick={() => onApply(draft)}>적용하기</button></footer></div></dialog>, document.body);
}
export default function MobileAdminBots() {
  useDocumentTitle('봇 관리');
  return <MobileAdminLayout><BotsContent /></MobileAdminLayout>;
}
function BotsContent() {
  const client = useQueryClient();
  const { toast, showSuccess, showError, hideToast } = useToast();
  const [busy, setBusy] = useState(null);
  const lock = useRef(false);
  const [deleting, setDeleting] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const run = async (bot, action) => {
    if (lock.current) return;
    lock.current = true; setBusy({ id: bot.id, action }); hideToast(); setDeleteError('');
    try {
      if (action === '삭제') {
        const remove = { youtube: deleteYouTubeBot, x: deleteXBot, festival: deleteFestivalBot }[bot.type];
        if (!remove || !bot.db_id) throw new Error('삭제할 봇 정보를 확인해주세요.');
        await remove(bot.db_id);
        setDeleting(null);
        showSuccess(`${bot.name} 봇을 삭제했습니다.`);
      } else if (action === '동기화') {
        const result = await syncAllVideos(bot.id);
        showSuccess(bot.type === 'meilisearch' ? `검색 동기화 완료: ${result.total ?? 0}건` : `동기화 완료: ${result.addedCount ?? 0}개 추가 (전체 ${result.total ?? 0}개)`);
      } else {
        await (action === '정지' ? stopBot : startBot)(bot.id);
        await client.cancelQueries({ queryKey: ['admin', 'bots'], exact: true });
        client.setQueryData(['admin', 'bots'], previous => previous?.map(item => item.id === bot.id ? { ...item, status: action === '정지' ? 'stopped' : 'running' } : item));
        showSuccess(`${bot.name} 봇을 ${action === '정지' ? '정지' : '시작'}했습니다.`);
      }
    } catch (err) {
      const message = err.message || '요청을 처리하지 못했습니다. 다시 시도해주세요.';
      if (action === '삭제') setDeleteError(message); else showError(message);
    } finally {
      await client.invalidateQueries({ queryKey: ['admin', 'bots'] });
      for (const key of [['admin', 'logs'], ['admin', 'mobile'], ['admin', 'pending'], ['admin', 'videos'], ['videos'], ['videosHome'], ['schedules']]) client.invalidateQueries({ queryKey: key });
      lock.current = false; setBusy(null);
    }
  };
  const query = useQuery({ queryKey: ['admin', 'bots'], queryFn: getBots, staleTime: 0, refetchInterval: 30000 });
  const quota = useQuery({ queryKey: ['admin', 'bots', 'quota'], queryFn: getQuotaWarning, staleTime: 60000 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ type: '', status: '' });
  const [draft, setDraft] = useState(null);
  const bots = query.data || [];
  const filtered = bots.filter(bot => (!filters.type || bot.type === filters.type) && (!filters.status || bot.status === filters.status) && String(bot.name).toLowerCase().includes(search.trim().toLowerCase()));
  const active = Boolean(filters.type || filters.status);
  return <>
    <Toast toast={toast} onClose={hideToast} />
    <h1 className="text-[26px] font-extrabold">봇 관리</h1>
    <div className="mb-5 mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-mute" aria-label="봇 상태 요약"><span>전체 <b className="text-ink">{query.isSuccess ? bots.length : '—'}</b></span>{statuses.map(([status, name]) => <span key={status}>{name} <b className={status === 'running' ? 'text-green-deep' : status === 'error' ? 'text-[#A93226]' : 'text-ink'}>{query.isSuccess ? bots.filter(bot => bot.status === status).length : '—'}</b></span>)}</div>
    <div className="mb-4 flex gap-2"><div className="flex min-w-0 flex-1 items-center gap-2 border border-hairline bg-white px-3"><Search size={18} className="shrink-0 text-mute" /><input type="search" aria-label="봇 이름 검색" placeholder="봇 이름 검색" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none [&::-webkit-search-cancel-button]:hidden" />{search && <button aria-label="검색어 지우기" onClick={() => setSearch('')} className="h-11"><X size={17} /></button>}</div><button aria-label={active ? '상세 필터 · 적용됨' : '상세 필터'} onClick={() => setDraft(filters)} className={`${button} relative flex w-12 shrink-0 items-center justify-center bg-white`}><SlidersHorizontal size={19} />{active && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />}</button></div>
    {quota.data?.active && <p role="alert" className="mb-4 border border-[#E5B8B3] bg-[#F9E9E7] p-3 text-sm text-[#A93226]">{quota.data.message || 'YouTube API 할당량 경고가 있습니다.'}</p>}
    {query.isPending ? <p role="status" className="py-16 text-center text-sm text-mute">봇 목록을 불러오는 중...</p> : query.isError ? <div role="alert" className="py-10 text-sm text-[#A93226]">봇 목록을 불러오지 못했습니다.<button className={`${button} mt-3 block`} onClick={() => query.refetch()}>다시 시도</button></div> : !filtered.length ? <p role="status" className="py-16 text-center text-sm text-mute">{bots.length ? '선택한 조건에 맞는 봇이 없습니다.' : '등록된 봇이 없습니다.'}</p> : <ul aria-label="봇 목록" className="space-y-3">{filtered.map(bot => {
      const manageable = ['youtube', 'x', 'festival'].includes(bot.type);
      return <li key={bot.id} className="rounded-[3px] border border-hairline bg-white p-4"><div className="flex items-center justify-between gap-2"><span className="rounded bg-[#F3F4F3] px-2 py-1 text-xs font-bold text-esub">{types.find(([key]) => key === bot.type)?.[1] || bot.type}</span><span className={`rounded px-2 py-1 text-xs font-bold ${statusStyle[bot.status] || statusStyle.stopped}`}>● {statuses.find(([key]) => key === bot.status)?.[1] || '알 수 없음'}</span></div><h2 className="mt-3 break-words text-lg font-extrabold">{bot.name}</h2><p className="mt-2 text-xs leading-relaxed text-mute">{bot.weekly_schedule_config ? '실행 일정' : '수집 간격'} · {interval(bot)}</p><dl className="mt-3 grid grid-cols-2 divide-x divide-hairline rounded bg-[#F6F7F6] py-3"><div className="px-3"><dt className="text-xs text-mute">총 추가</dt><dd className="mt-1 text-lg font-bold">{(bot.schedules_added || 0).toLocaleString()}건</dd></div><div className="px-3"><dt className="text-xs text-mute">최근</dt><dd className="mt-1 text-lg font-bold">+{(bot.last_added_count || 0).toLocaleString()}건</dd></div></dl><p className="mt-3 text-xs text-mute">마지막 확인 · {lastCheck(bot.last_check_at)}</p>{bot.status === 'error' && <Link to="/admin/logs?actor=bot&action=error" className="mt-2 inline-flex min-h-11 items-center text-xs font-bold text-[#A93226]">활동 로그에서 오류 확인 ›</Link>}
        <div aria-label="봇 관리 작업" className={`mt-3 grid gap-2 border-t border-hairline pt-3 ${manageable ? 'grid-cols-4' : 'grid-cols-2'}`}>{[[bot.status === 'running' ? Square : Play, bot.status === 'running' ? '정지' : '시작'], [RefreshCw, '동기화'], ...(manageable ? [[Pencil, '수정'], [Trash2, '삭제']] : [])].map(([Icon, label]) => <button key={label} disabled={Boolean(busy)} aria-label={`${bot.name} ${label}`} title={label} onClick={() => { if (label === '수정') { hideToast(); setEditing(bot); } else if (label === '삭제') { setDeleteError(''); setDeleting(bot); } else run(bot, label); }} className={`flex min-h-11 items-center justify-center border border-hairline bg-white disabled:opacity-40 ${label === '삭제' ? 'text-[#C97070]' : 'text-esub'}`}><Icon size={18} className={label === '동기화' && busy?.id === bot.id && busy.action === label ? 'animate-spin' : ''} /></button>)}</div>
      </li>;
    })}</ul>}
    {[['youtube', YouTubeBotDialog], ['x', XBotDialog], ['festival', FestivalBotDialog]].map(([type, Editor]) => <Editor key={type} mobile isOpen={editing?.type === type} botId={editing?.type === type ? editing.db_id : null} onClose={() => setEditing(null)} onSuccess={() => { showSuccess('봇을 수정했습니다.'); client.invalidateQueries({ queryKey: ['admin', 'logs'] }); client.invalidateQueries({ queryKey: ['admin', 'mobile'] }); }} />)}
    <ConfirmDialog isOpen={Boolean(deleting)} onClose={() => { if (!lock.current) setDeleting(null); }} onConfirm={() => run(deleting, '삭제')} loading={Boolean(busy)} title="봇 삭제" confirmText="삭제하기" message={<><p className="break-words">“{deleting?.name}” 봇을 삭제할까요?</p>{deleteError && <p role="alert" className="mt-2 text-[#A93226]">{deleteError}</p>}</>} />
    <Filters value={draft} onClose={() => setDraft(null)} onApply={value => { setFilters(value); setDraft(null); }} />
  </>;
}
