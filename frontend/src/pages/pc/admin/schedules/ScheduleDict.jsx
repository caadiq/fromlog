/**
 * 관리자 사전 관리 — 에디토리얼 리뉴얼 (design-drafts/ADM_dict 시안)
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, ChevronDown } from 'lucide-react';
import { Toast } from '@/components/common';
import { AdminLayout, AdminPageHeader, ConfirmDialog } from '@/components/pc/admin';
import { WordItem, POS_TAGS } from '@/components/pc/admin/schedule';
import { useAdminAuth } from '@/hooks/pc/admin';
import { useToast, useDocumentTitle } from '@/hooks/common';
import { EASE } from '@/components/editorial';
import * as suggestionsApi from '@/api/admin/suggestions';

function ScheduleDict() {
  const { user, isAuthenticated } = useAdminAuth();
  const { toast, setToast } = useToast();
  useDocumentTitle('검색어 사전');
  const [entries, setEntries] = useState([]); // [{word, pos, isComment, id}]
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPos, setFilterPos] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // 새 단어 입력
  const [newWord, setNewWord] = useState('');
  const [newPos, setNewPos] = useState('NNP');
  const [showNewPosDropdown, setShowNewPosDropdown] = useState(false);

  // 드롭다운 refs
  const newPosDropdownRef = useRef(null);
  const filterDropdownRef = useRef(null);

  // 다이얼로그 상태
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [wordToDelete, setWordToDelete] = useState(null); // { index, word, id }

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (newPosDropdownRef.current && !newPosDropdownRef.current.contains(event.target)) {
        setShowNewPosDropdown(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };

    if (showNewPosDropdown || showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNewPosDropdown, showFilterDropdown]);

  // 필터링된 항목
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (entry.isComment) return true; // 주석은 항상 포함 (but 표시 안함)

      const matchesSearch =
        !searchQuery || entry.word.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPos = filterPos === 'all' || entry.pos === filterPos;

      return matchesSearch && matchesPos;
    });
  }, [entries, searchQuery, filterPos]);

  // 실제 단어 항목만 (주석 제외)
  const wordEntries = useMemo(() => {
    return filteredEntries.filter((e) => !e.isComment);
  }, [filteredEntries]);

  // 품사별 통계
  const posStats = useMemo(() => {
    const stats = { total: 0 };
    entries.forEach((e) => {
      if (!e.isComment) {
        stats.total++;
        stats[e.pos] = (stats[e.pos] || 0) + 1;
      }
    });
    return stats;
  }, [entries]);

  // 고유 ID 생성
  const generateId = useCallback(
    () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    []
  );

  // 사전 파일 파싱
  const parseDict = useCallback((content) => {
    const lines = content.split('\n');
    return lines
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          return {
            isComment: true,
            raw: line,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          };
        }
        const parts = trimmed.split('\t');
        return {
          word: parts[0] || '',
          pos: parts[1] || 'NNP',
          isComment: false,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
      })
      .filter((e) => e.isComment || e.word); // 빈 줄 제거하되 주석은 유지
  }, []);

  // 사전 파일 생성
  const serializeDict = useCallback((entries) => {
    return entries
      .map((e) => {
        if (e.isComment) return e.raw;
        return `${e.word}\t${e.pos}`;
      })
      .join('\n');
  }, []);

  // 사전 내용 조회 (useQuery)
  const {
    data: dictContent,
    isLoading: loading,
    isError,
  } = useQuery({
    queryKey: ['admin', 'dict'],
    queryFn: async () => {
      const data = await suggestionsApi.getDict();
      return data.content || '';
    },
    enabled: isAuthenticated,
  });

  // 사전 데이터 로드 후 파싱
  useEffect(() => {
    if (dictContent !== undefined) {
      const parsed = parseDict(dictContent);
      setEntries(parsed);
    }
  }, [dictContent, parseDict]);

  // 에러 처리
  useEffect(() => {
    if (isError) {
      setToast({ type: 'error', message: '사전을 불러올 수 없습니다.' });
    }
  }, [isError, setToast]);

  // 사전 저장 (entries 배열을 받아서 저장)
  const saveDict = async (newEntries) => {
    try {
      const content = serializeDict(newEntries);
      await suggestionsApi.saveDict(content);
      return true;
    } catch (error) {
      console.error('사전 저장 오류:', error);
      setToast({ type: 'error', message: error.message || '저장 중 오류가 발생했습니다.' });
      return false;
    }
  };

  // 단어 추가 다이얼로그 열기
  const openAddDialog = () => {
    if (!newWord.trim()) return;

    // 중복 확인
    const isDuplicate = entries.some(
      (e) => !e.isComment && e.word.toLowerCase() === newWord.trim().toLowerCase()
    );
    if (isDuplicate) {
      setToast({ type: 'error', message: '이미 존재하는 단어입니다.' });
      return;
    }

    setAddDialogOpen(true);
  };

  // 단어 추가 확인
  const handleAddWord = async () => {
    setSaving(true);
    const wordToAdd = newWord.trim();
    const newEntry = { word: wordToAdd, pos: newPos, isComment: false, id: generateId() };
    const newEntries = [...entries, newEntry];

    const success = await saveDict(newEntries);
    if (success) {
      setEntries(newEntries);
      setNewWord('');
      setToast({ type: 'success', message: `"${wordToAdd}" 단어가 추가되었습니다.` });
    }
    setAddDialogOpen(false);
    setSaving(false);
  };

  // 단어 수정 (id 기반)
  const handleUpdateWord = async (id, word, pos) => {
    const entryIndex = entries.findIndex((e) => e.id === id);
    if (entryIndex === -1) return;

    const newEntries = [...entries];
    newEntries[entryIndex] = { ...newEntries[entryIndex], word, pos };

    const success = await saveDict(newEntries);
    if (success) {
      setEntries(newEntries);
    }
  };

  // 단어 삭제 다이얼로그 열기
  const openDeleteDialog = (id, word) => {
    setWordToDelete({ id, word });
    setDeleteDialogOpen(true);
  };

  // 단어 삭제 확인
  const handleDeleteWord = async () => {
    if (!wordToDelete) return;

    setSaving(true);
    const deletedWord = wordToDelete.word;
    const newEntries = entries.filter((e) => e.id !== wordToDelete.id);

    const success = await saveDict(newEntries);
    if (success) {
      setEntries(newEntries);
      setToast({ type: 'success', message: `"${deletedWord}" 단어가 삭제되었습니다.` });
    }
    setDeleteDialogOpen(false);
    setWordToDelete(null);
    setSaving(false);
  };

  // 엔터키로 추가 다이얼로그 열기
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      openAddDialog();
    }
  };

  const STATS = [
    { label: 'TOTAL', value: posStats.total || 0 },
    { label: '고유명사 NNP', value: posStats.NNP || 0 },
    { label: '일반명사 NNG', value: posStats.NNG || 0 },
    { label: '외국어 SL', value: posStats.SL || 0 },
  ];

  return (
    <AdminLayout user={user}>
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* 단어 추가 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={addDialogOpen}
        onClose={() => !saving && setAddDialogOpen(false)}
        onConfirm={handleAddWord}
        title="단어 추가"
        message={
          <>
            <p className="mb-2">다음 단어를 추가하시겠습니까?</p>
            <div className="border border-hairline bg-paper p-3">
              <p className="font-extrabold text-ink">{newWord}</p>
              <p className="mt-1 text-[12.5px] font-bold text-mute">
                {POS_TAGS.find((t) => t.value === newPos)?.label}
              </p>
            </div>
          </>
        }
        confirmText="추가"
        loadingText="추가 중..."
        loading={saving}
        variant="primary"
        icon={Plus}
      />

      {/* 단어 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => {
          if (!saving) {
            setDeleteDialogOpen(false);
            setWordToDelete(null);
          }
        }}
        onConfirm={handleDeleteWord}
        title="단어 삭제"
        message={
          <>
            <p className="mb-2">다음 단어를 삭제하시겠습니까?</p>
            <p className="border border-hairline bg-paper p-3 font-extrabold text-ink">{wordToDelete?.word}</p>
          </>
        }
        confirmText="삭제"
        loadingText="삭제 중..."
        loading={saving}
        variant="danger"
      />

      {/* 메인 콘텐츠 */}
      <div className="mx-auto w-full max-w-[980px] px-10 pb-[90px] pt-[52px]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <AdminPageHeader crumb="ADMIN / SCHEDULE / DICTIONARY" solid="DICTIO" outline="NARY" />
          <p className="mt-3 text-[14px] text-mute">
            검색 형태소 분석기가 사용하는 사용자 사전입니다. 고유명사를 등록하면 검색 품질이 좋아집니다.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
        >
          {/* 통계 */}
          <div className="mt-7 grid grid-cols-4 border-t-2 border-ink">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={`border-b border-hairline py-4 pr-1.5 ${i > 0 ? 'border-l pl-6' : 'pl-1.5'}`}
              >
                <div className="text-[12px] font-extrabold tracking-k2 text-mute">{s.label}</div>
                <b
                  className="mt-1.5 block text-[28px] font-black leading-none tracking-[-1px]"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {s.value}
                </b>
              </div>
            ))}
          </div>

          {/* 단어 추가 영역 */}
          <div className="mt-9 flex items-end gap-2.5">
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="추가할 단어를 입력하세요"
              className="min-w-0 flex-1 border-b-2 border-ink bg-transparent px-0.5 pb-2.5 pt-2 text-[16px] font-bold text-ink placeholder-faint outline-none"
            />
            <div className="relative w-[220px] shrink-0" ref={newPosDropdownRef}>
              <button
                onClick={() => setShowNewPosDropdown(!showNewPosDropdown)}
                className="flex w-full items-center justify-between gap-2 border border-hairline bg-white px-3.5 py-3 text-[14px] font-bold text-ink transition-colors hover:border-ink"
              >
                <span>{POS_TAGS.find((t) => t.value === newPos)?.label}</span>
                <ChevronDown
                  size={14}
                  className={`text-mute transition-transform ${showNewPosDropdown ? 'rotate-180' : ''}`}
                />
              </button>
              <AnimatePresence>
                {showNewPosDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute left-0 top-full z-40 mt-1.5 w-64 border border-ink bg-white py-1"
                  >
                    {POS_TAGS.map((tag) => (
                      <button
                        key={tag.value}
                        onClick={() => {
                          setNewPos(tag.value);
                          setShowNewPosDropdown(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left transition-colors ${
                          newPos === tag.value ? 'bg-canvas' : 'hover:bg-canvas'
                        }`}
                      >
                        <div className="text-[14px] font-extrabold text-ink">{tag.label}</div>
                        <div className="mt-0.5 text-[13px] text-mute">{tag.description}</div>
                        <div className="mt-0.5 text-[12.5px] text-faint">예: {tag.examples}</div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={openAddDialog}
              disabled={!newWord.trim()}
              className="shrink-0 whitespace-nowrap bg-ink px-[26px] py-3 text-[13px] font-extrabold tracking-k15 text-white transition-colors hover:bg-ebody disabled:cursor-not-allowed disabled:opacity-50"
            >
              + 추가
            </button>
          </div>

          {/* 검색 및 필터 */}
          <div className="mt-10 flex items-end gap-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2 border-b border-faint px-0.5 pb-2.5">
              <Search size={14} className="shrink-0 text-mute" strokeWidth={2.5} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="단어 검색"
                className="min-w-0 flex-1 bg-transparent text-[14.5px] font-semibold text-ink placeholder-faint outline-none"
              />
            </div>
            <div className="relative shrink-0" ref={filterDropdownRef}>
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex w-[170px] items-center justify-between gap-2 border border-hairline bg-white px-3.5 py-2.5 text-[13.5px] font-bold text-ink transition-colors hover:border-ink"
              >
                <span>
                  {filterPos === 'all'
                    ? '전체 품사'
                    : POS_TAGS.find((t) => t.value === filterPos)?.label.split(' ')[0]}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-mute transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`}
                />
              </button>
              <AnimatePresence>
                {showFilterDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute right-0 top-full z-40 mt-1.5 w-48 border border-ink bg-white py-1"
                  >
                    <button
                      onClick={() => {
                        setFilterPos('all');
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-[14px] font-semibold transition-colors ${
                        filterPos === 'all' ? 'bg-ink text-white' : 'text-ebody hover:bg-canvas'
                      }`}
                    >
                      전체 품사
                    </button>
                    {POS_TAGS.map((tag) => (
                      <button
                        key={tag.value}
                        onClick={() => {
                          setFilterPos(tag.value);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-[14px] font-semibold transition-colors ${
                          filterPos === tag.value ? 'bg-ink text-white' : 'text-ebody hover:bg-canvas'
                        }`}
                      >
                        {tag.label.split(' ')[0]}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 테이블 */}
          {loading ? (
            <div className="py-24 text-center text-[14.5px] text-mute">로딩 중...</div>
          ) : wordEntries.length === 0 ? (
            <div className="py-20 text-center text-mute">
              <p className="text-[14.5px]">
                {searchQuery || filterPos !== 'all' ? '검색 결과가 없습니다' : '등록된 단어가 없습니다'}
              </p>
              <p className="mt-1 text-[13.5px] text-faint">위의 입력창에서 단어를 추가하세요</p>
            </div>
          ) : (
            <>
              <div className="mt-[18px] max-h-[500px] overflow-y-auto border-t-2 border-ink [scrollbar-width:thin]">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-30 bg-paper">
                    <tr>
                      <th className="w-16 border-b border-hairline px-2 py-3 text-left text-[12px] font-extrabold tracking-k2 text-mute">#</th>
                      <th className="border-b border-hairline px-2 py-3 text-left text-[12px] font-extrabold tracking-k2 text-mute">단어</th>
                      <th className="w-44 border-b border-hairline px-2 py-3 text-left text-[12px] font-extrabold tracking-k2 text-mute">품사</th>
                      <th className="w-20 border-b border-hairline px-2 py-3 text-right text-[12px] font-extrabold tracking-k2 text-mute">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {wordEntries.map((entry, index) => (
                        <WordItem
                          key={entry.id}
                          id={entry.id}
                          word={entry.word}
                          pos={entry.pos}
                          index={index}
                          onUpdate={handleUpdateWord}
                          onDelete={() => openDeleteDialog(entry.id, entry.word)}
                        />
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* 푸터 */}
              <div className="mt-3.5 text-right text-[13px] text-mute">
                {searchQuery || filterPos !== 'all' ? (
                  <span>
                    {wordEntries.length}개 검색됨 (전체 {posStats.total}개)
                  </span>
                ) : (
                  <span>총 {posStats.total}개 단어</span>
                )}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AdminLayout>
  );
}

export default ScheduleDict;
