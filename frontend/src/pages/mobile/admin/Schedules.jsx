import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X, SlidersHorizontal, ChevronLeft, ChevronRight, ChevronDown, CalendarDays } from 'lucide-react';
import { useDocumentTitle, useToast } from '@/hooks/common';
import { Toast } from '@/components/common';
import ConfirmDialog from '@/components/pc/admin/common/ConfirmDialog';
import CustomSelect from '@/components/pc/admin/common/CustomSelect';
import YearMonthPicker from '@/components/pc/admin/common/YearMonthPicker';
import { getSchedules, deleteSchedule } from '@/api/admin/schedules';
import { decodeHtmlEntities, getTodayKST, invalidateSchedules } from '@/utils';
import { getCategoryInfo, getScheduleDate, getScheduleTime } from '@/utils/schedule';
import MobileAdminLayout from './Layout';

const normalize = value => String(value || '').normalize('NFC').toLowerCase().replace(/\s+/g, '');
const button = 'flex min-h-11 items-center justify-center rounded-[2px] border border-hairline bg-white px-3 text-sm font-bold disabled:opacity-40';
function dateLabel(item) {
  const value = getScheduleDate(item).slice(0, 10);
  const date = new Date(`${value}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return { short: '미정', weekday: '날짜' };
  if (item.datePrecision === 'month') return { short: `${Number(value.slice(5, 7))}월`, weekday: '날짜 미정' };
  return { short: `${Number(value.slice(5, 7))}.${value.slice(8, 10)}`, weekday: new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(date) };
}

export default function MobileAdminSchedules() {
  useDocumentTitle('일정 관리');
  return <MobileAdminLayout><ScheduleList /></MobileAdminLayout>;
}

function ScheduleList() {
  const [month, setMonth] = useState(() => getTodayKST().slice(0, 7));
  const [year, monthNumber] = month.split('-').map(Number);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [target, setTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const client = useQueryClient();
  const { toast, showSuccess, hideToast } = useToast();
  const query = useQuery({ queryKey: ['adminSchedules', year, monthNumber], queryFn: () => getSchedules(year, monthNumber) });
  const items = query.data || [];
  const categories = [...new Set(items.map(item => getCategoryInfo(item).name))];
  const filtered = useMemo(() => items.filter(item => (category === 'all' || getCategoryInfo(item).name === category)
    && normalize([decodeHtmlEntities(item.title), item.source?.name, getScheduleDate(item)].join(' ')).includes(normalize(search)))
    .sort((a, b) => Number(a.datePrecision === 'month') - Number(b.datePrecision === 'month')
      || getScheduleDate(a).localeCompare(getScheduleDate(b))
      || (getScheduleTime(a) || '99:99').localeCompare(getScheduleTime(b) || '99:99')
      || String(a.id).localeCompare(String(b.id), 'en', { numeric: true })), [items, category, search]);
  const changeMonth = value => { setMonth(value); setPickerOpen(false); setCategory('all'); hideToast(); };
  const moveMonth = delta => {
    const next = new Date(year, monthNumber - 1 + delta, 1);
    changeMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };
  const closeDelete = () => { if (!busy.current) { setTarget(null); setError(''); } };
  const confirmDelete = async () => {
    if (!target || busy.current) return;
    busy.current = true;
    setDeleting(true);
    setError('');
    try {
      await deleteSchedule(target.id);
      await client.cancelQueries({ queryKey: ['adminSchedules'] });
      client.setQueriesData({ queryKey: ['adminSchedules'] }, old => Array.isArray(old) ? old.filter(item => String(item.id) !== String(target.id)) : old);
      invalidateSchedules(client);
      client.invalidateQueries({ queryKey: ['admin', 'mobile'] });
      client.invalidateQueries({ queryKey: ['admin', 'logs'] });
      client.invalidateQueries({ queryKey: ['admin', 'stats'] });
      setTarget(null);
      showSuccess('일정이 삭제되었습니다.');
    } catch (err) {
      setError(err.message || '삭제하지 못했습니다. 다시 시도해주세요.');
    } finally { busy.current = false; setDeleting(false); }
  };

  return <>
    <Toast toast={toast} onClose={hideToast} />
    <h1 className="text-[26px] font-extrabold tracking-tight">일정 관리</h1>
    <div className="mt-5 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center">
        <button className="flex h-11 w-9 shrink-0 items-center justify-center" aria-label="이전 달" onClick={() => moveMonth(-1)}><ChevronLeft size={20} /></button>
        <button className="flex min-h-11 items-center gap-1 text-base font-extrabold" aria-expanded={pickerOpen} onClick={() => { setPickerYear(year); setPickerOpen(!pickerOpen); }}>{year}년 {monthNumber}월<ChevronDown size={17} /></button>
        <button className="flex h-11 w-9 shrink-0 items-center justify-center" aria-label="다음 달" onClick={() => moveMonth(1)}><ChevronRight size={20} /></button>
      </div>
      <button className={button} onClick={() => changeMonth(getTodayKST().slice(0, 7))}>오늘</button>
    </div>
    <YearMonthPicker open={pickerOpen} year={pickerYear} month={monthNumber - 1} onSelectYear={setPickerYear} onSelectMonth={value => changeMonth(`${pickerYear}-${String(value + 1).padStart(2, '0')}`)} className="relative mt-2 w-full" />
    <div className="mt-3 flex items-start gap-2">
      <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-[4px] border border-hairline bg-white pl-3 focus-within:border-ink">
        <Search size={19} className="shrink-0 text-mute" />
        <input type="search" aria-label="선택한 월 일정 검색" placeholder="이번 달 일정 검색" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none [&::-webkit-search-cancel-button]:hidden" />
        {search && <button aria-label="검색어 지우기" className="flex h-11 w-9 shrink-0 items-center justify-center" onClick={() => setSearch('')}><X size={17} /></button>}
      </div>
      <CustomSelect value={category} onChange={setCategory} options={[{ value: 'all', label: '전체' }, ...[...new Set([...categories, ...(category === 'all' ? [] : [category])])].map(name => ({ value: name, label: name }))]} triggerIcon={<SlidersHorizontal size={20} />} ariaLabel="일정 카테고리" className="w-12 shrink-0 [&_button]:min-h-11" />
    </div>
    {query.isSuccess && <p role="status" className="mt-3 text-sm text-mute">{category === 'all' ? '전체' : category} {filtered.length}건{search.trim() ? ' · 검색 결과' : ''}</p>}
    {query.isPending ? <p role="status" className="py-16 text-center text-sm text-mute">일정을 불러오는 중...</p> : query.isError ? <div role="alert" className="mt-5 border border-[#E5B8B3] p-5 text-sm text-[#A93226]">일정을 불러오지 못했습니다.<button className={`${button} mt-3`} disabled={query.isFetching} onClick={() => query.refetch()}>다시 시도</button></div> : filtered.length === 0 ? <div className="mt-5 flex flex-col items-center gap-3 border border-dashed border-hairline px-5 py-16 text-mute"><CalendarDays size={30} /><p className="text-sm">{search || category !== 'all' ? '검색 조건에 맞는 일정이 없습니다.' : '이번 달에 등록된 일정이 없습니다.'}</p></div> : <ul aria-label="일정 목록" className="mt-5 space-y-4">
      {filtered.map(item => {
        const date = dateLabel(item);
        const info = getCategoryInfo(item);
        const title = decodeHtmlEntities(item.title);
        const canManage = !item.is_birthday && /^\d+$/.test(String(item.id));
        const Body = canManage ? Link : 'div';
        return <li key={item.id} className="rounded-[4px] border border-hairline bg-white p-3.5">
          <Body {...(canManage ? { to: `/schedule/${item.id}`, 'aria-label': `${title} 상세 보기` } : {})} className="flex items-start gap-3">
            <div className="flex h-[60px] w-[60px] shrink-0 flex-col items-center justify-center rounded-[4px] bg-[#F5F5F3] text-center"><span className="text-[19px] font-extrabold tracking-tight">{date.short}</span><span className="mt-0.5 text-[12px] text-esub">{date.weekday}</span></div>
            <div className="min-w-0 flex-1 py-1"><h2 className="break-words text-base font-extrabold leading-[1.5]">{title}</h2><div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-mute"><span className="rounded-[3px] bg-green-soft px-1.5 py-0.5 text-xs font-semibold text-green-deep">{info.name}</span><span>{item.datePrecision === 'month' ? '날짜 미정' : getScheduleTime(item) || '시간 미정'}{item.source?.name ? ` · ${item.source.name}` : ''}</span></div></div>
            {canManage && <ChevronRight size={18} className="my-5 shrink-0 text-mute" />}
          </Body>
          {canManage && <div className="mt-3 grid grid-cols-[minmax(0,1fr)_72px] gap-2"><button disabled title="모바일 수정 기능은 준비 중입니다." className="min-h-11 rounded-[2px] bg-ink px-3 text-sm font-bold text-white disabled:opacity-40">수정</button><button disabled={deleting} className={`${button} border-ink`} onClick={() => { setError(''); hideToast(); setTarget(item); }}>삭제</button></div>}
        </li>;
      })}
    </ul>}
    <ConfirmDialog isOpen={Boolean(target)} onClose={closeDelete} onConfirm={confirmDelete} title="이 일정을 삭제할까요?" confirmText="삭제하기" loading={deleting} message={<><p className="break-words font-semibold text-ink">{target ? decodeHtmlEntities(target.title) : ''}</p><p className="mt-2">삭제한 일정은 복구할 수 없습니다.</p>{error && <p role="alert" className="mt-3 break-words text-[#A93226]">{error}</p>}</>} />
  </>;
}
