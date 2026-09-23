import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Inbox, Clock, MapPin, AlertCircle } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/common';
import { getPending } from '@/api/admin/pending';
import MobileAdminLayout from './Layout';

const normalize = value => String(value || '').normalize('NFC').toLowerCase().replace(/\s+/g, '');
function formatDate(value) {
  if (!value) return '날짜 미정';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return '날짜 확인 필요';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(date);
}

export default function MobileAdminQueue() {
  useDocumentTitle('수집 큐');
  return <MobileAdminLayout><QueueList /></MobileAdminLayout>;
}

function QueueList() {
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: ['pending-schedules'], queryFn: getPending });
  const items = query.data?.items || [];
  const filtered = useMemo(() => {
    const term = normalize(search);
    return items.filter(item => normalize([item.title, item.date, item.venueName, item.description, ...(item.members || [])].join(' ')).includes(term));
  }, [items, search]);

  return <>
    <h1 className="text-[26px] font-extrabold tracking-tight">수집 큐</h1>
    <p className="mt-1 text-sm text-mute">{query.isSuccess ? `검토 대기 ${items.length}건` : '수집된 일정을 확인하세요.'}</p>
    <div className="mt-6 flex min-h-12 items-center gap-2 border border-hairline bg-white pl-3 focus-within:border-ink">
      <Search size={19} className="shrink-0 text-mute" aria-hidden="true" />
      <input type="search" aria-label="수집 큐 검색" placeholder="일정 제목, 장소 검색" value={search} onChange={e => setSearch(e.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none [&::-webkit-search-cancel-button]:hidden" />
      {search ? <button onClick={() => setSearch('')} aria-label="검색어 지우기" className="flex h-12 w-12 shrink-0 items-center justify-center"><X size={18} /></button> : <span className="w-3" />}
    </div>

    {query.isPending ? <p role="status" className="py-16 text-center text-sm text-mute">수집 큐를 불러오는 중...</p> : query.isError ? <div role="alert" className="mt-5 border border-[#E5B8B3] bg-[#F9E9E7] p-5 text-sm text-[#A93226]">수집 큐를 불러오지 못했습니다.<button onClick={() => query.refetch()} disabled={query.isFetching} className="mt-3 block min-h-11 border border-current px-4 font-bold disabled:opacity-50">{query.isFetching ? '불러오는 중...' : '다시 시도'}</button></div> : items.length === 0 ? <div className="mt-6 flex flex-col items-center gap-3 border border-dashed border-hairline px-5 py-16 text-mute"><Inbox size={30} /><p className="text-base font-bold">검토할 일정이 없습니다.</p><p className="text-sm">새로 수집된 일정이 여기에 표시됩니다.</p></div> : <>
      {search.trim() && <p role="status" className="mt-4 text-sm text-mute">검색 결과 {filtered.length}건</p>}
      {filtered.length === 0 ? <p className="py-16 text-center text-sm text-mute">검색 결과가 없습니다.</p> : <ul aria-label="검토 대기 일정" className="mt-5 space-y-4">
        {filtered.map(item => <li key={item.id} className="border border-hairline bg-white p-5">
          <p className={`text-[13px] font-semibold ${item.date ? 'text-mute' : 'text-[#A93226]'}`}>{formatDate(item.date)}</p>
          <h2 className="mt-2 break-words text-[17px] font-extrabold leading-relaxed">{item.title}</h2>
          <div className="mt-3 space-y-2 text-sm text-esub">
            <p className="flex items-center gap-2"><Clock size={16} className="shrink-0 text-mute" /><span>{item.time || '시간 미정'}</span></p>
            {item.venueName && <p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-mute" /><span className="min-w-0 break-words">{item.venueName}</span></p>}
            {item.members?.length > 0 && <p className="break-words">멤버 · {item.members.join(', ')}</p>}
            {item.description && <p className="whitespace-pre-wrap break-words leading-relaxed text-mute">{item.description}</p>}
          </div>
          {(item.dupHint || item.stale || item.createdScheduleId) && <div className="mt-4 space-y-2 border-t border-hairline pt-3 text-[13px] leading-relaxed">
            {item.dupHint && <p className="flex gap-2 text-[#8A6D1B]"><AlertCircle size={16} className="mt-0.5 shrink-0" /><span className="min-w-0 break-words">중복 확인 필요 · {item.dupHint}</span></p>}
            {item.stale && <p className="text-[#A93226]">최신 원문에서 사라진 일정입니다. 날짜 변경이나 취소 여부를 확인해주세요.</p>}
            {item.createdScheduleId && <p className="text-[#8A6D1B]">일정은 저장됐지만 등록 처리가 완료되지 않았습니다.</p>}
          </div>}
        </li>)}
      </ul>}
    </>}
  </>;
}
