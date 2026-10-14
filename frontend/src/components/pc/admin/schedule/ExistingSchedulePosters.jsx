import { useEffect, useRef, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { fetchAuthApi } from '@/api/client';

// Keep the programme name while dropping only a trailing episode label.
export function posterSearchTitle(title = '') {
  return title.trim().replace(/\s*(?:\(\s*)?(?:(?:제\s*)?\d+\s*[회화부]|EP\.?\s*\d+)\s*\)?$/i, '').trim();
}

export default function ExistingSchedulePosters({ title, maxCount, selected, onSelect, disabled }) {
  const [query, setQuery] = useState(() => posterSearchTitle(title));
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const requestRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        const result = await fetchAuthApi(`/admin/schedule-posters/?q=${encodeURIComponent(query.trim())}&offset=${page * 30}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setItems(previous => page ? [...previous, ...result.items] : result.items);
        setHasMore(result.hasMore);
      } catch (err) { if (!controller.signal.aborted) setError(err.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, page, retry]);

  const changeQuery = value => {
    requestRef.current?.abort();
    setQuery(value); setPage(0); setItems([]); setHasMore(false); setLoading(true); onSelect([]);
  };
  const keyOf = item => `${item.scheduleId}-${item.imageId}`;
  const toggle = item => {
    const exists = selected.some(value => keyOf(value) === keyOf(item));
    onSelect(exists ? selected.filter(value => keyOf(value) !== keyOf(item))
      : maxCount === 1 ? [item] : selected.length < maxCount ? [...selected, item] : selected);
  };

  return <section aria-label="기존 일정 이미지 검색">
    <label htmlFor="poster-schedule-search" className="mb-2 block text-[13px] font-bold">일정 제목으로 검색</label>
    <div className="relative"><Search size={18} className="pointer-events-none absolute left-3 top-3.5 text-mute" />
      <input id="poster-schedule-search" value={query} maxLength={500} disabled={disabled} placeholder="예: 계약결혼"
        onChange={event => changeQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }}
        className="w-full border border-hairline py-3 pl-10 pr-3 text-[16px] outline-none focus:border-ink" />
    </div>
    <p className="mb-4 mt-2 break-keep text-[13px] leading-relaxed text-mute">이전에 등록한 일정의 이미지를 선택해주세요. 검색어를 지우면 최근 이미지가 표시됩니다.</p>
    <div className="grid grid-cols-2 gap-3">
      {items.map(item => {
        const checked = selected.some(value => keyOf(value) === keyOf(item));
        return <button key={keyOf(item)} type="button" aria-label={`${item.title} · ${item.date} 이미지`} aria-pressed={checked}
          disabled={disabled || (!checked && maxCount > 1 && selected.length >= maxCount)} onClick={() => toggle(item)}
          className={`overflow-hidden border-2 text-left disabled:opacity-50 ${checked ? 'border-ink' : 'border-hairline'}`}>
          <div className="relative aspect-[4/3] bg-paper"><img src={item.previewUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
            <span className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center border ${checked ? 'border-ink bg-ink text-white' : 'border-hairline bg-white/90'}`}>{checked && <Check size={16} />}</span>
          </div>
          <div className="px-2.5 py-2"><p className="line-clamp-2 text-[13px] font-bold leading-relaxed">{item.title}</p><p className="mt-1 text-[13px] text-mute">{item.date}</p></div>
        </button>;
      })}
    </div>
    {loading && <p role="status" className="py-6 text-center text-sm text-mute">이미지를 찾는 중...</p>}
    {!loading && !error && !items.length && <p className="py-6 text-center text-sm leading-relaxed text-mute">이미지가 있는 일정을 찾지 못했습니다.<br />프로그램명만 입력하거나 검색어를 지워보세요.</p>}
    {error && <div role="alert" className="mt-4 text-sm text-[#C0392B]">{error}<button type="button" disabled={disabled || loading} onClick={() => setRetry(value => value + 1)} className="ml-2 underline">다시 시도</button></div>}
    {hasMore && !loading && !error && <button type="button" disabled={disabled} onClick={() => setPage(value => value + 1)} className="mt-4 w-full border border-hairline py-3 text-sm font-bold">더 보기</button>}
  </section>;
}
