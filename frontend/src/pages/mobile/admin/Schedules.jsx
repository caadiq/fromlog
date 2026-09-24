import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Grid3x3 } from 'lucide-react';
import { useDocumentTitle, useToast } from '@/hooks/common';
import { Toast } from '@/components/common';
import ConfirmDialog from '@/components/pc/admin/common/ConfirmDialog';
import { CalendarPanel, YearMonthPanel } from '@/components/mobile/schedule/CalendarPanels';
import { MIN_YEAR, WEEKDAYS, WEEKDAYS_LONG } from '@/constants';
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
  const [selectedDate, setSelectedDate] = useState(getTodayKST);
  const month = selectedDate.slice(0, 7);
  const selectedDay = new Date(`${selectedDate}T12:00:00`);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const strip = useRef(null);
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
  const categories = [...new Set([...items.map(item => getCategoryInfo(item).name), ...(category === 'all' ? [] : [category])])];
  const days = Array.from({ length: new Date(year, monthNumber, 0).getDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  const searching = Boolean(search.trim());
  const dots = items.filter(item => item.datePrecision !== 'month' && (category === 'all' || getCategoryInfo(item).name === category));
  useEffect(() => {
    const container = strip.current;
    const active = container?.querySelector('[aria-pressed="true"]');
    if (active) container.scrollLeft = active.offsetLeft - container.offsetLeft - (container.clientWidth - active.clientWidth) / 2;
  }, [selectedDate, calendarOpen, pickerOpen]);
  const filtered = useMemo(() => items.filter(item => (category === 'all' || getCategoryInfo(item).name === category)
    && (searching || item.datePrecision === 'month' || getScheduleDate(item).slice(0, 10) === selectedDate)
    && normalize([decodeHtmlEntities(item.title), item.source?.name, getScheduleDate(item)].join(' ')).includes(normalize(search)))
    .sort((a, b) => Number(a.datePrecision === 'month') - Number(b.datePrecision === 'month')
      || getScheduleDate(a).localeCompare(getScheduleDate(b))
      || (getScheduleTime(a) || '99:99').localeCompare(getScheduleTime(b) || '99:99')
      || String(a.id).localeCompare(String(b.id), 'en', { numeric: true })), [items, category, search, selectedDate, searching]);
  const chooseDate = value => { setSelectedDate(value); setPickerOpen(false); setCalendarOpen(false); setSearch(''); hideToast(); };
  const changeMonth = value => { chooseDate(value === getTodayKST().slice(0, 7) ? getTodayKST() : `${value}-01`); };
  const fromDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
    <div className="mt-4 flex items-center justify-between border-b border-hairline pb-2">
      <div className="flex min-w-0 items-center">
        <button disabled={year <= MIN_YEAR && monthNumber === 1} className="flex h-11 w-8 shrink-0 items-center justify-center disabled:opacity-30" aria-label="이전 달" onClick={() => moveMonth(-1)}><ChevronLeft size={18} /></button>
        <button className="flex min-h-11 items-center gap-1 text-lg font-extrabold" aria-label={`${year}년 ${monthNumber}월 선택`} aria-expanded={pickerOpen} onClick={() => { setPickerYear(year); setPickerOpen(!pickerOpen); setCalendarOpen(false); }}>{year}. {monthNumber}<ChevronDown size={14} /></button>
        <button className="flex h-11 w-8 shrink-0 items-center justify-center" aria-label="다음 달" onClick={() => moveMonth(1)}><ChevronRight size={18} /></button>
      </div>
      <div className="flex items-center">
        <button className="flex h-11 w-11 items-center justify-center" aria-label="달력" aria-expanded={calendarOpen} onClick={() => { setCalendarOpen(!calendarOpen); setPickerOpen(false); }}><Grid3x3 size={20} /></button>
        <button className="flex h-11 w-11 items-center justify-center" aria-label="일정 검색" aria-expanded={searchOpen} onClick={() => { setSearchOpen(!searchOpen); setSearch(''); }}><Search size={20} /></button>
      </div>
    </div>
    {pickerOpen ? <YearMonthPanel year={pickerYear} month={monthNumber - 1} onSelectYear={setPickerYear} onSelectMonth={value => changeMonth(`${pickerYear}-${String(value + 1).padStart(2, '0')}`)} /> : calendarOpen ? <CalendarPanel viewDate={selectedDay} selectedDate={selectedDay} schedules={dots} onSelectDate={date => chooseDate(fromDate(date))} onToday={() => chooseDate(getTodayKST())} /> : <div ref={strip} aria-label="날짜 선택" className="relative scrollbar-hide flex overflow-x-auto overscroll-x-contain border-b border-hairline py-3">
      {days.map(value => {
        const date = new Date(`${value}T12:00:00`);
        const dow = date.getDay();
        const selected = value === selectedDate;
        return <button key={value} aria-label={`${monthNumber}월 ${date.getDate()}일 ${WEEKDAYS_LONG[dow]}`} aria-pressed={selected} onClick={() => chooseDate(value)} className={`flex w-[calc(100%/7)] min-w-[40px] shrink-0 flex-col items-center gap-1 py-2 ${selected ? 'bg-ink text-white' : dow === 0 ? 'text-cal-sun' : dow === 6 ? 'text-cal-sat' : 'text-ink'}`}>
          <span className={`text-[13px] font-bold ${selected ? '' : dow > 0 && dow < 6 ? 'text-mute' : ''}`}>{WEEKDAYS[dow]}</span><b className="text-lg font-extrabold">{date.getDate()}</b>
          <span className="flex h-2 items-center gap-1">{dots.filter(item => getScheduleDate(item).slice(0, 10) === value).slice(0, 3).map(item => <i key={item.id} className="h-1 w-1 rounded-full" style={{ backgroundColor: getCategoryInfo(item).color, boxShadow: selected ? '0 0 0 1px white' : undefined }} />)}</span>
        </button>;
      })}
    </div>}
    <div aria-label="일정 카테고리" className="scrollbar-hide flex gap-2 overflow-x-auto border-b border-hairline py-3">
      {['all', ...categories].map(name => <button key={name} aria-pressed={category === name} onClick={() => setCategory(name)} className={`flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border px-3 text-[13px] font-bold ${category === name ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-esub'}`}>
        {name !== 'all' && <i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getCategoryInfo(items.find(item => getCategoryInfo(item).name === name) || {}).color }} />}{name === 'all' ? '전체' : name} {name === 'all' ? items.length : items.filter(item => getCategoryInfo(item).name === name).length}
      </button>)}
    </div>
    {searchOpen && <div className="mt-3 flex min-h-12 items-center gap-2 rounded-[4px] border border-hairline bg-white px-3">
      <Search size={19} className="shrink-0 text-mute" />
      <input autoFocus type="search" aria-label="선택한 월 일정 검색" placeholder="이번 달 전체 일정 검색" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none [&::-webkit-search-cancel-button]:hidden" />
      {search && <button aria-label="검색어 지우기" className="flex h-11 w-8 shrink-0 items-center justify-center" onClick={() => setSearch('')}><X size={17} /></button>}
    </div>}
    <div className="mt-6 flex items-center justify-between gap-2">
      <h2 className="flex items-baseline gap-2">{searching ? <b className="text-xl font-extrabold">검색 결과</b> : <><b className="text-[30px] font-black tracking-tight">{monthNumber}. {selectedDay.getDate()}.</b><span className="text-[13px] font-bold text-mute">{WEEKDAYS_LONG[selectedDay.getDay()]}</span></>}</h2>
      <button className={button} onClick={() => chooseDate(getTodayKST())}>오늘</button>
    </div>
    {query.isSuccess && <p role="status" className="mt-1 text-[13px] text-mute">{searching ? `${monthNumber}월 검색 결과 ${filtered.length}건` : `선택한 날짜 ${filtered.filter(item => item.datePrecision !== 'month').length}건`}</p>}
    {query.isPending ? <p role="status" className="py-16 text-center text-sm text-mute">일정을 불러오는 중...</p> : query.isError ? <div role="alert" className="mt-5 border border-[#E5B8B3] p-5 text-sm text-[#A93226]">일정을 불러오지 못했습니다.<button className={`${button} mt-3`} disabled={query.isFetching} onClick={() => query.refetch()}>다시 시도</button></div> : filtered.length === 0 ? <div className="mt-5 flex flex-col items-center gap-3 border border-dashed border-hairline px-5 py-16 text-mute"><CalendarDays size={30} /><p className="text-sm">{search || category !== 'all' ? '검색 조건에 맞는 일정이 없습니다.' : '선택한 날짜에 등록된 일정이 없습니다.'}</p></div> : <ul aria-label="일정 목록" className="mt-5 space-y-4">
      {filtered.map((item, index) => {
        const date = dateLabel(item);
        const info = getCategoryInfo(item);
        const title = decodeHtmlEntities(item.title);
        const canManage = !item.is_birthday && /^\d+$/.test(String(item.id));
        const Body = canManage ? Link : 'div';
        return <li key={item.id}>
          {!searching && item.datePrecision === 'month' && (index === 0 || filtered[index - 1].datePrecision !== 'month') && <h3 className="mb-3 mt-6 border-t border-dashed border-hairline pt-4 text-sm font-bold text-mute">날짜 미정 · {monthNumber}월 중</h3>}
          <div className="rounded-[4px] border border-hairline bg-white p-3.5">
          <Body {...(canManage ? { to: `/schedule/${item.id}`, 'aria-label': `${title} 상세 보기` } : {})} className="flex items-start gap-3">
            <div className="flex h-[60px] w-[60px] shrink-0 flex-col items-center justify-center rounded-[4px] bg-[#F5F5F3] text-center"><span className="text-[19px] font-extrabold tracking-tight">{date.short}</span><span className="mt-0.5 text-[12px] text-esub">{date.weekday}</span></div>
            <div className="min-w-0 flex-1 py-1"><h2 className="break-words text-base font-extrabold leading-[1.5]">{title}</h2><div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-mute"><span className="rounded-[3px] bg-green-soft px-1.5 py-0.5 text-xs font-semibold text-green-deep">{info.name}</span><span>{item.datePrecision === 'month' ? '날짜 미정' : getScheduleTime(item) || '시간 미정'}{item.source?.name ? ` · ${item.source.name}` : ''}</span></div></div>
            {canManage && <ChevronRight size={18} className="my-5 shrink-0 text-mute" />}
          </Body>
          {canManage && <div className="mt-3 grid grid-cols-[minmax(0,1fr)_72px] gap-2"><button disabled title="모바일 수정 기능은 준비 중입니다." className="min-h-11 rounded-[2px] bg-ink px-3 text-sm font-bold text-white disabled:opacity-40">수정</button><button disabled={deleting} className={`${button} border-ink`} onClick={() => { setError(''); hideToast(); setTarget(item); }}>삭제</button></div>}
          </div>
        </li>;
      })}
    </ul>}
    <ConfirmDialog isOpen={Boolean(target)} onClose={closeDelete} onConfirm={confirmDelete} title="이 일정을 삭제할까요?" confirmText="삭제하기" loading={deleting} message={<><p className="break-words font-semibold text-ink">{target ? decodeHtmlEntities(target.title) : ''}</p><p className="mt-2">삭제한 일정은 복구할 수 없습니다.</p>{error && <p role="alert" className="mt-3 break-words text-[#A93226]">{error}</p>}</>} />
  </>;
}
