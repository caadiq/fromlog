import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X, Inbox, AlertCircle, ArrowUpDown } from 'lucide-react';
import { useDocumentTitle, useToast } from '@/hooks/common';
import { getPending, dismissPending } from '@/api/admin/pending';
import { Toast } from '@/components/common';
import CustomSelect from '@/components/pc/admin/common/CustomSelect';
import ConfirmDialog from '@/components/pc/admin/common/ConfirmDialog';
import { invalidatePending, invalidateSchedules } from '@/utils';
import QueueReview from './QueueReview';
import MobileAdminLayout from './Layout';

const normalize = value => String(value || '').normalize('NFC').toLowerCase().replace(/\s+/g, '');
function formatDate(value) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return null;
  return { short: `${Number(String(value).slice(5, 7))}.${String(value).slice(8, 10)}`, weekday: new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(date), full: String(value).slice(0, 10) };
}

export default function MobileAdminQueue() {
  useDocumentTitle('수집 큐');
  return <MobileAdminLayout><QueueList /></MobileAdminLayout>;
}

function QueueList() {
  const [reviewTarget, setReviewTarget] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('registered');
  const [dismissTarget, setDismissTarget] = useState(null);
  const [dismissing, setDismissing] = useState(false);
  const [dismissError, setDismissError] = useState('');
  const { toast, showSuccess, showError, hideToast } = useToast();
  const busy = useRef(false);
  const queryClient = useQueryClient();
  const closeDismiss = () => {
    if (!busy.current) { setDismissTarget(null); setDismissError(''); }
  };
  const confirmDismiss = async () => {
    if (!dismissTarget || busy.current) return;
    busy.current = true;
    setDismissing(true);
    setDismissError('');
    try {
      await dismissPending(dismissTarget.id);
      // Remove only after the server confirms; refresh all queue count consumers.
      await queryClient.cancelQueries({ queryKey: ['pending-schedules'] });
      queryClient.setQueryData(['pending-schedules'], old => old ? { ...old, items: old.items.filter(item => item.id !== dismissTarget.id) } : old);
      showSuccess('일정을 무시했습니다.');
      setDismissTarget(null);
      invalidatePending(queryClient);
      queryClient.invalidateQueries({ queryKey: ['admin', 'mobile', 'recent-logs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'logs'] });
    } catch (error) {
      setDismissError(error.message || '무시 처리에 실패했습니다. 다시 시도해주세요.');
    } finally {
      busy.current = false;
      setDismissing(false);
    }
  };
  const query = useQuery({ queryKey: ['pending-schedules'], queryFn: getPending });
  const items = query.data?.items || [];
  const filtered = useMemo(() => {
    const term = normalize(search);
    // Queue IDs preserve insertion order, including rows collected in the same second.
    const byRegistration = (a, b) => Number(a.id) - Number(b.id);
    return items.filter(item => normalize([item.title, item.date, item.venueName, item.description, ...(item.members || [])].join(' ')).includes(term)).sort((a, b) => {
      if (sortOrder === 'name') return String(a.title || '').localeCompare(String(b.title || ''), 'ko', { numeric: true }) || byRegistration(a, b);
      if (sortOrder === 'date') {
        return String(a.date || '9999-12-31').localeCompare(String(b.date || '9999-12-31'))
          || String(a.time || '99:99').localeCompare(String(b.time || '99:99'))
          || byRegistration(a, b);
      }
      return byRegistration(a, b);
    });
  }, [items, search, sortOrder]);

  return <>
    <Toast toast={toast} onClose={hideToast} />
    <h1 className="text-[26px] font-extrabold tracking-tight">수집 큐</h1>
    <p className="mt-1 text-sm text-mute">{query.isSuccess ? `검토 대기 ${items.length}건` : '수집된 일정을 확인하세요.'}</p>
    <div className="mt-6 flex items-start gap-2">
    <div className="flex min-w-0 flex-1 min-h-12 items-center gap-2 border border-hairline rounded-[4px] bg-white pl-3 focus-within:border-ink">
      <Search size={19} className="shrink-0 text-mute" aria-hidden="true" />
      <input type="search" aria-label="수집 큐 검색" placeholder="학교명 또는 일정 검색" value={search} onChange={e => setSearch(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none [&::-webkit-search-cancel-button]:hidden" />
      {search ? <button onClick={() => setSearch('')} aria-label="검색어 지우기" className="flex h-12 w-12 shrink-0 items-center justify-center"><X size={18} /></button> : <span className="w-3" />}
    </div>

      <CustomSelect value={sortOrder} onChange={setSortOrder} options={[
        { value: 'registered', label: '등록순' },
        { value: 'date', label: '날짜순' },
        { value: 'name', label: '이름순' },
      ]} triggerIcon={<ArrowUpDown size={20} />} ariaLabel="큐 정렬" className="w-12 shrink-0 [&_button]:min-h-11" />
    </div>
    {query.isPending ? <p role="status" className="py-16 text-center text-sm text-mute">수집 큐를 불러오는 중...</p> : query.isError ? <div role="alert" className="mt-5 border border-[#E5B8B3] bg-[#F9E9E7] p-5 text-sm text-[#A93226]">수집 큐를 불러오지 못했습니다.<button onClick={() => query.refetch()} disabled={query.isFetching} className="mt-3 block min-h-11 border border-current px-4 font-bold disabled:opacity-50">{query.isFetching ? '불러오는 중...' : '다시 시도'}</button></div> : items.length === 0 ? <div className="mt-6 flex flex-col items-center gap-3 border border-dashed border-hairline px-5 py-16 text-mute"><Inbox size={30} /><p className="text-base font-bold">검토할 일정이 없습니다.</p><p className="text-sm">새로 수집된 일정이 여기에 표시됩니다.</p></div> : <>
      {search.trim() && <p role="status" className="mt-4 text-sm text-mute">검색 결과 {filtered.length}건</p>}
      {filtered.length === 0 ? <p className="py-16 text-center text-sm text-mute">검색 결과가 없습니다.</p> : <ul aria-label="검토 대기 일정" className="mt-5 space-y-4">
        {filtered.map(item => {
          const date = formatDate(item.date);
          return <li key={item.id} className="rounded-[4px] border border-hairline bg-white p-3.5">
          <div className="flex items-start gap-3">
            <div className="flex h-[60px] w-[60px] shrink-0 flex-col items-center justify-center rounded-[4px] bg-[#F5F5F3] px-1 py-2 text-center" aria-label={date?.full || '날짜 미정'}>
              {date ? <><span className="text-[19px] font-extrabold tracking-tight">{date.short}</span><span className="mt-0.5 text-[13px] text-esub">{date.weekday}</span></> : <span className="text-[13px] font-bold leading-relaxed text-mute">날짜<br />미정</span>}
            </div>
            <div className="min-w-0 flex-1 py-1">
              <h2 className="break-words text-[16px] font-extrabold leading-[1.5]">{item.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-relaxed text-mute">
                {item.category && <span className="shrink-0 rounded-[3px] bg-green-soft px-1.5 py-0.5 text-[12px] font-semibold text-green-deep">{item.category}</span>}
                <span>{item.time || '시간 미정'}{!item.date || !item.time ? ' · 정보 보완 필요' : ''}</span>
              </div>
            </div>
          </div>
          {(item.dupHint || item.stale || item.createdScheduleId) && <div className="mt-4 space-y-2 border-t border-hairline pt-3 text-[13px] leading-relaxed">
            {item.dupHint && <p className="flex gap-2 text-[#8A6D1B]"><AlertCircle size={16} className="mt-0.5 shrink-0" /><span className="min-w-0 break-words">중복 확인 필요 · {item.dupHint}</span></p>}
            {item.stale && <p className="text-[#A93226]">최신 원문에서 사라진 일정입니다. 날짜 변경이나 취소 여부를 확인해주세요.</p>}
            {item.createdScheduleId && <p className="text-[#8A6D1B]">일정은 저장됐지만 등록 처리가 완료되지 않았습니다.</p>}
          </div>}
          <div className="mt-3 grid grid-cols-[2fr_3fr] gap-2">
            <button type="button" disabled={registering || Boolean(item.createdScheduleId)} onClick={() => { setDismissError(''); hideToast(); setDismissTarget(item); }} title={item.createdScheduleId ? '이미 일정이 생성된 항목은 무시할 수 없습니다.' : undefined} className="min-h-11 rounded-[2px] border border-ink bg-white px-3 text-[14px] font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40">무시</button>
            <button type="button" disabled={registering} onClick={() => { hideToast(); setReviewTarget(item); }} className="min-h-11 rounded-[2px] bg-ink px-3 text-[14px] font-bold text-white disabled:cursor-not-allowed">검토 후 등록</button>
          </div>
        </li>;
        })}
      </ul>}
    </>}
    <QueueReview item={reviewTarget} onClose={() => setReviewTarget(null)} onBusyChange={setRegistering}
      onFailure={message => showError(message)}
      onLinked={(id, createdScheduleId) => {
        queryClient.setQueryData(['pending-schedules'], old => old ? { ...old, items: old.items.map(item => item.id === id ? { ...item, createdScheduleId } : item) } : old);
      }}
      onSuccess={async id => {
        setReviewTarget(null);
        await queryClient.cancelQueries({ queryKey: ['pending-schedules'] });
        queryClient.setQueryData(['pending-schedules'], old => old ? { ...old, items: old.items.filter(item => item.id !== id) } : old);
        invalidatePending(queryClient);
        invalidateSchedules(queryClient);
        queryClient.invalidateQueries({ queryKey: ['admin', 'mobile'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'logs'] });
        showSuccess('일정으로 등록했습니다.');
      }} />
    <ConfirmDialog
      isOpen={Boolean(dismissTarget)}
      onClose={closeDismiss}
      onConfirm={confirmDismiss}
      title="이 일정을 무시할까요?"
      message={<><p className="break-words font-semibold text-ink">{dismissTarget?.title}</p><p className="mt-2">수집 큐에서 제외되며 일정으로 등록되지 않습니다.</p>{dismissError && <p role="alert" className="mt-3 break-words text-[#A93226]">{dismissError}</p>}</>}
      confirmText="무시하기"
      loading={dismissing}
      loadingText="처리 중..."
      variant="primary"
    />
  </>;
}
