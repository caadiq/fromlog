/**
 * 관리자 활동 로그 — 에디토리얼 리뉴얼 (design-drafts/ADM_logs 시안)
 */
import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronLeft, ChevronRight, ChevronDown, Check } from 'lucide-react';
import {
  AdminLayout, AdminPageHeader, DatePicker,
  CATEGORY_LABELS, ACTION_STYLES, ACTION_LABELS, ITEMS_PER_PAGE, formatDateTime,
  LogDetailDialog, ActorBadge, Summary,
} from '@/components/pc/admin';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useDocumentTitle } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import { adminLogApi } from '@/api/admin';

// 드롭다운 버튼 공통 스타일
const dropBtn =
  'flex items-center justify-between gap-2 border bg-white px-3.5 py-2.5 text-[13.5px] font-bold transition-colors';

function Logs() {
  const { user } = useAdminAuth();
  useDocumentTitle('활동 로그');

  // 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [actorFilter, setActorFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [actorDropdownOpen, setActorDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  // 검색어 디바운스
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 카테고리 목록 조회
  const { data: categoryData } = useQuery({
    queryKey: ['admin', 'logs', 'categories'],
    queryFn: () => adminLogApi.getLogCategories(),
    staleTime: 5 * 60 * 1000,
  });
  const categories = categoryData?.categories || [];

  // 로그 API 호출
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'logs', { page: currentPage, category: selectedCategories.join(','), actor: actorFilter === 'all' ? '' : actorFilter, search: debouncedSearch, from: dateFrom, to: dateTo }],
    queryFn: () => adminLogApi.getLogs({
      page: currentPage,
      limit: ITEMS_PER_PAGE,
      category: selectedCategories.join(',') || undefined,
      actor: actorFilter === 'all' ? undefined : actorFilter,
      search: debouncedSearch || undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    }),
    placeholderData: keepPreviousData,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 0;

  // 페이지 변경 시 입력 필드 동기화
  useEffect(() => { setPageInput(String(currentPage)); }, [currentPage]);

  const goToPageFromInput = () => {
    const n = parseInt(pageInput, 10);
    if (!Number.isFinite(n) || n < 1) {
      setPageInput(String(currentPage));
      return;
    }
    const clamped = Math.min(totalPages, n);
    setCurrentPage(clamped);
    setPageInput(String(clamped));
  };

  // 카테고리 토글
  const toggleCategory = (cat) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
    setCurrentPage(1);
  };

  // 카테고리 드롭다운 버튼 텍스트
  const getCategoryButtonText = () => {
    if (selectedCategories.length === 0) return '전체 카테고리';
    if (selectedCategories.length === 1) return CATEGORY_LABELS[selectedCategories[0]] || selectedCategories[0];
    return `카테고리 (${selectedCategories.length})`;
  };

  // 필터 초기화
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setActorFilter('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || selectedCategories.length > 0 || actorFilter !== 'all' || dateFrom || dateTo;

  return (
    <AdminLayout user={user}>
      <div className="mx-auto w-full max-w-[1180px] px-10 pb-[90px] pt-[52px]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <AdminPageHeader crumb="ADMIN / LOGS" solid="ACTIVITY " outline="LOGS" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
        >
          {/* 필터 영역 */}
          <div className="mt-8 flex items-end gap-2.5">
            {/* 검색 */}
            <div className="flex min-w-0 flex-1 items-center gap-2 border-b border-faint px-0.5 pb-2.5">
              <Search size={14} className="shrink-0 text-mute" strokeWidth={2.5} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="내용 검색"
                className="min-w-0 flex-1 bg-transparent text-[14.5px] font-semibold text-ink placeholder-faint outline-none"
              />
            </div>

            {/* 행위자 드롭다운 */}
            <div className="relative shrink-0">
              <button
                onClick={() => { setActorDropdownOpen(!actorDropdownOpen); setCategoryDropdownOpen(false); }}
                className={`${dropBtn} w-[130px] border-hairline text-ink hover:border-ink`}
              >
                <span>{actorFilter === 'all' ? '전체 행위자' : actorFilter === 'admin' ? '관리자' : '봇'}</span>
                <ChevronDown size={14} className="text-mute" />
              </button>
              <AnimatePresence>
                {actorDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setActorDropdownOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full z-20 mt-1.5 w-[130px] border border-ink bg-white py-1"
                    >
                      {[
                        { value: 'all', label: '전체 행위자' },
                        { value: 'admin', label: '관리자' },
                        { value: 'bot', label: '봇' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setActorFilter(opt.value); setActorDropdownOpen(false); setCurrentPage(1); }}
                          className={`w-full px-3.5 py-2 text-left text-[13.5px] font-semibold transition-colors ${
                            actorFilter === opt.value ? 'bg-ink text-white' : 'text-ebody hover:bg-canvas'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* 카테고리 드롭다운 */}
            <div className="relative shrink-0">
              <button
                onClick={() => categories.length > 0 && (setCategoryDropdownOpen(!categoryDropdownOpen), setActorDropdownOpen(false))}
                disabled={categories.length === 0}
                className={`${dropBtn} w-[150px] ${
                  categories.length === 0
                    ? 'cursor-not-allowed border-hairline text-faint'
                    : selectedCategories.length > 0
                      ? 'border-ink text-ink'
                      : 'border-hairline text-ink hover:border-ink'
                }`}
              >
                <span>{getCategoryButtonText()}</span>
                <ChevronDown size={14} className="text-mute" />
              </button>
              <AnimatePresence>
                {categoryDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCategoryDropdownOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full z-20 mt-1.5 w-44 border border-ink bg-white py-1"
                    >
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => toggleCategory(cat)}
                          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13.5px] font-semibold text-ebody transition-colors hover:bg-canvas"
                        >
                          <span
                            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center border ${
                              selectedCategories.includes(cat) ? 'border-ink bg-ink' : 'border-faint'
                            }`}
                          >
                            {selectedCategories.includes(cat) && <Check size={11} className="text-white" />}
                          </span>
                          {CATEGORY_LABELS[cat] || cat}
                        </button>
                      ))}
                      {selectedCategories.length > 0 && (
                        <>
                          <div className="my-1 border-t border-hairline" />
                          <button
                            onClick={() => { setSelectedCategories([]); setCurrentPage(1); }}
                            className="w-full px-3.5 py-2 text-left text-[13.5px] font-semibold text-mute transition-colors hover:bg-canvas"
                          >
                            선택 해제
                          </button>
                        </>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* 날짜 필터 */}
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="w-40">
                <DatePicker
                  value={dateFrom}
                  onChange={(v) => { setDateFrom(v); setCurrentPage(1); }}
                  placeholder="시작일"
                  max={dateTo || undefined}
                  compact
                />
              </div>
              <span className="text-[13.5px] text-faint">~</span>
              <div className="w-40">
                <DatePicker
                  value={dateTo}
                  onChange={(v) => { setDateTo(v); setCurrentPage(1); }}
                  placeholder="종료일"
                  min={dateFrom || undefined}
                  compact
                />
              </div>
            </div>

            {/* 필터 초기화 */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="shrink-0 pb-2.5 text-[12.5px] font-extrabold tracking-k1 text-mute transition-colors hover:text-ink"
              >
                초기화
              </button>
            )}
          </div>

          {/* 결과 개수 */}
          <p className="mt-7 text-[13.5px] text-mute">
            총{' '}
            <b className="font-extrabold text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {total.toLocaleString()}
            </b>
            건
          </p>

          {/* 로그 테이블 */}
          <table className="mt-2.5 w-full table-fixed border-collapse border-t-2 border-ink">
            <thead>
              <tr>
                <th className="w-[13%] border-b border-hairline px-2 py-3 text-left text-[12px] font-extrabold tracking-k2 text-mute">시간</th>
                {/* meilisearch-sync 처럼 긴 봇 이름이 옆 칸에 붙지 않도록 여유를 둔다 */}
                <th className="w-[19%] border-b border-hairline px-2 py-3 text-left text-[12px] font-extrabold tracking-k2 text-mute">행위자</th>
                <th className="w-[8%] border-b border-hairline px-2 py-3 text-left text-[12px] font-extrabold tracking-k2 text-mute">액션</th>
                <th className="w-[9%] border-b border-hairline px-2 py-3 text-left text-[12px] font-extrabold tracking-k2 text-mute">카테고리</th>
                <th className="border-b border-hairline px-2 py-3 text-left text-[12px] font-extrabold tracking-k2 text-mute">내용</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => (
                <motion.tr
                  key={log.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="cursor-pointer border-b border-hairline transition-colors hover:bg-canvas"
                  onClick={() => setSelectedLog(log)}
                >
                  <td
                    className="whitespace-nowrap px-2 py-3.5 text-[13.5px] text-esub"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-3.5">
                    <ActorBadge actor={log.actor} />
                  </td>
                  <td className="whitespace-nowrap px-2 py-3.5">
                    <span
                      className={`inline-block px-2.5 py-1 text-[12px] font-extrabold tracking-k1 ${
                        ACTION_STYLES[log.action] || 'bg-canvas text-esub'
                      }`}
                    >
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-3.5 text-[13.5px] font-semibold text-esub">
                    {CATEGORY_LABELS[log.category] || log.category}
                  </td>
                  <td className="px-2 py-3.5 text-[14.5px] font-semibold text-ink">
                    <div className="truncate">
                      <Summary summary={log.summary} />
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>

          {isLoading && logs.length === 0 && (
            <div className="py-20 text-center text-[14.5px] text-mute">로그를 불러오는 중...</div>
          )}

          {!isLoading && logs.length === 0 && (
            <div className="py-20 text-center text-[14.5px] text-mute">
              {hasActiveFilters ? '검색 결과가 없습니다.' : '활동 로그가 없습니다.'}
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="mt-8 grid grid-cols-3 items-center">
              <div />
              <div className="flex items-center justify-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="이전 페이지"
                  className="flex h-9 w-9 items-center justify-center border border-hairline bg-white text-esub transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 2) return true;
                    return false;
                  })
                  .reduce((acc, page, i, arr) => {
                    if (i > 0 && page - arr[i - 1] > 1) {
                      acc.push({ type: 'ellipsis', key: `e-${page}` });
                    }
                    acc.push({ type: 'page', value: page, key: page });
                    return acc;
                  }, [])
                  .map((item) =>
                    item.type === 'ellipsis' ? (
                      <span key={item.key} className="flex h-9 w-9 items-center justify-center text-[13.5px] text-faint">
                        …
                      </span>
                    ) : (
                      <button
                        key={item.key}
                        onClick={() => setCurrentPage(item.value)}
                        className={`h-9 min-w-[36px] px-1.5 text-[13.5px] font-bold transition-colors ${
                          currentPage === item.value
                            ? 'bg-ink text-white'
                            : 'text-esub hover:bg-canvas hover:text-ink'
                        }`}
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {item.value}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="다음 페이지"
                  className="flex h-9 w-9 items-center justify-center border border-hairline bg-white text-esub transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
                  onBlur={goToPageFromInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      goToPageFromInput();
                      e.currentTarget.blur();
                    }
                  }}
                  className="h-9 w-12 border-b-2 border-ink bg-transparent text-center text-[14.5px] font-bold text-ink outline-none"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                  aria-label="페이지 번호 입력"
                />
                <span className="text-[13.5px] text-mute" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  / {totalPages}
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* 로그 상세 다이얼로그 */}
      <LogDetailDialog log={selectedLog} onClose={() => setSelectedLog(null)} />
    </AdminLayout>
  );
}

export default Logs;
